package com.atlassian.plugins.guile.rest;

import com.atlassian.crowd.embedded.api.User;
import com.atlassian.jira.bc.issue.IssueService;
import com.atlassian.jira.bc.issue.search.SearchService;
import com.atlassian.jira.issue.CustomFieldManager;
import com.atlassian.jira.issue.Issue;
import com.atlassian.jira.issue.MutableIssue;
import com.atlassian.jira.issue.changehistory.ChangeHistory;
import com.atlassian.jira.issue.changehistory.ChangeHistoryManager;
import com.atlassian.jira.issue.fields.CustomField;
import com.atlassian.jira.issue.history.ChangeItemBean;
import com.atlassian.jira.issue.search.SearchException;
import com.atlassian.jira.jql.builder.JqlClauseBuilder;
import com.atlassian.jira.jql.builder.JqlQueryBuilder;
import com.atlassian.jira.security.JiraAuthenticationContext;
import com.atlassian.jira.user.ApplicationUser;
import com.atlassian.jira.web.bean.PagerFilter;
import com.atlassian.sal.api.user.UserManager;
import com.atlassian.plugins.rest.common.security.AnonymousAllowed;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.MultivaluedMap;
import javax.ws.rs.core.Response;
import java.sql.Timestamp;
import java.util.*;

import com.sun.jersey.api.client.*;
import com.sun.jersey.api.client.WebResource.Builder;
import com.sun.jersey.api.client.config.ClientConfig;
import com.sun.jersey.api.client.config.DefaultClientConfig;
import com.sun.jersey.api.json.JSONConfiguration;
import com.sun.jersey.core.util.MultivaluedMapImpl;
import org.codehaus.jackson.annotate.JsonIgnoreProperties;
import org.codehaus.jackson.annotate.JsonProperty;

/**
 * A resource of message.
 */
@Path("/")
public class MyRestResource {

    private final IssueService issueService;
    private final JiraAuthenticationContext jiraAuthenticationContext;
    private final UserManager userManager;
    private final com.atlassian.jira.user.util.UserManager jiraUserManager;
    private final SearchService searchService;
    private final CustomFieldManager fieldManager;
    private final ChangeHistoryManager historyManager;

    public MyRestResource(JiraAuthenticationContext jiraAuthenticationContext, IssueService issueService,
                          SearchService searchService, CustomFieldManager fieldService, UserManager userManager,
                          com.atlassian.jira.user.util.UserManager jiraUserManager,
                          ChangeHistoryManager historyManager) {
        this.issueService = issueService;
        this.searchService = searchService;
        this.jiraAuthenticationContext = jiraAuthenticationContext;
        this.userManager = userManager;
        this.jiraUserManager = jiraUserManager;
        this.fieldManager = fieldService;
        this.historyManager = historyManager;
    }

    @GET
    @AnonymousAllowed
    @Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    @Path("message")
    public Response getMessage(@Context HttpServletRequest request) {
        ApplicationUser user = getCurrentUser(request);
        IssueService.IssueResult result = issueService.getIssue(user.getDirectoryUser(), "MOB-1");
        String output = "request was " + request.getMethod();
        output += " user is " + userManager.getRemoteUsername(request);

        if(result != null) {
            MutableIssue issue = result.getIssue();
            output += " description is " + issue.getDescription();

        }
        else
            output += " issue is null";

        CustomField sprint = fieldManager.getCustomFieldObjectByName("Sprint");
        if(sprint != null)
            output += " SPRINT ID IS (" + sprint.getIdAsLong() + ")";

        List<Issue> issues = getIssues(request);
        if(issues != null)
            output += " "  + issues.size() + " issue(s) in project ";
        else
            output += " unable to get list of project issues";

        for(Issue i:issues) {
            output += " " + i.getKey() + ":" + i.getCustomFieldValue(sprint);
        }

        issues = getSprintIssues(user.getDirectoryUser(),"MOB","Sprint 1");
        if(issues != null)
            output += " "  + issues.size() + " issue(s) in sprint ";
        else
            output += " unable to get list of sprint issues";

        output += " " + executeCall(request,"api/2/myself");

        return Response.ok(new MyRestResourceModel(output)).build();
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class sprintResponse {
        public SprintModel[] sprints;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class boardResponse {
        @JsonProperty("views")
        public BoardModel[] boards;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class sprintIssueContents {
        public IssueModel[] completedIssues;
        public IssueModel[] incompletedIssues;
        public IssueModel[] puntedIssues;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class sprintIssueResponse {
        @JsonProperty("contents")
        public sprintIssueContents contents;
    }

    @GET
    @AnonymousAllowed
    @Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    @Path("boards")
    public Response getBoards(@Context HttpServletRequest request) {
        boardResponse response = executeCall(request, boardResponse.class, "greenhopper/1.0/rapidview");

        return Response.ok(new GetBoardsModel(response.boards)).build();
    }

    @GET
    @AnonymousAllowed
    @Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    @Path("boards/{boardId}/sprints")
    public Response getSprints(@Context HttpServletRequest request, @PathParam("boardId") long id) {
        SprintModel[] sprints = executeCall(request,sprintResponse.class,"greenhopper/1.0/sprintquery/" + id).sprints;

        return Response.ok(new GetSprintsModel(sprints)).build();
    }

    @GET
    @AnonymousAllowed
    @Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    @Path("issue/{issueId}/changes")
    public Response getChanges(@Context HttpServletRequest request, @PathParam("issueId") String issueId, @DefaultValue("1970-01-01 00:00:00") @QueryParam("since") Timestamp since) {
        ApplicationUser user = getCurrentUser(request);
        IssueService.IssueResult result = issueService.getIssue(user.getDirectoryUser(), issueId);

        Hashtable<String, ArrayList<ChangeModel>> changes = new Hashtable<String, ArrayList<ChangeModel>>();

        if(result != null) {
            MutableIssue issue = result.getIssue();
            ArrayList<ChangeHistory> histories = new ArrayList<ChangeHistory>(historyManager.getChangeHistoriesSince(issue, since));

            Collections.sort(histories, new Comparator<ChangeHistory>() {
                @Override
                public int compare(ChangeHistory o1, ChangeHistory o2) {
                    return o1.getTimePerformed().compareTo(o2.getTimePerformed());
                }
            });

            for(ChangeHistory history:histories) {
                for(ChangeItemBean change:history.getChangeItemBeans()) {
                    ChangeModel c = new ChangeModel(change.getCreated(),
                            history.getAuthorObject().getKey(),
                            change.getField(),
                            change.getTo());

                    if(!changes.containsKey(c.getField())) {
                        ArrayList<ChangeModel> original = new ArrayList<ChangeModel>();
                        original.add(new ChangeModel(issue.getCreated(),
                                issue.getCreatorId(),
                                change.getField(),
                                change.getFrom()));
                        changes.put(c.getField(), original);
                    }

                    changes.get(c.getField()).add(c);
                }
            }

        }

        return Response.ok(new GetChangesModel(changes)).build();
    }

    @GET
    @AnonymousAllowed
    @Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    @Path("boards/{boardId}/sprints/{sprintId}/issues")
    public Response getSprintIssues(@Context HttpServletRequest request, @PathParam("boardId") long boardId, @PathParam("sprintId") long sprintId) {
        MultivaluedMap<String, String> query = new MultivaluedMapImpl();
        query.add("rapidViewId",Long.toString(boardId));
        query.add("sprintId",Long.toString(sprintId));

        sprintIssueResponse response = executeCall(request, sprintIssueResponse.class, "greenhopper/1.0/rapid/charts/sprintreport",query);

        ArrayList<IssueModel> issues = new ArrayList<IssueModel>();
        Collections.addAll(issues,response.contents.completedIssues);
        Collections.addAll(issues,response.contents.incompletedIssues);
        Collections.addAll(issues,response.contents.puntedIssues);

        return Response.ok(new GetSprintIssuesModel(issues.toArray(new IssueModel[issues.size()]))).build();
    }

    private String executeCall(HttpServletRequest req, String url) {
        return executeCall(req, String.class, url, new MultivaluedMapImpl());
    }

    private <T> T executeCall(HttpServletRequest req, Class<T> cls, String url) {
        return executeCall(req,cls,url,new MultivaluedMapImpl());
    }

    private <T> T executeCall(HttpServletRequest req, Class<T> cls, String url, MultivaluedMap<String, String> query) {
        ClientConfig clientConfig = new DefaultClientConfig();
        clientConfig.getFeatures().put(JSONConfiguration.FEATURE_POJO_MAPPING, Boolean.TRUE);
        Client client = Client.create(clientConfig);

        WebResource r = client.resource("http://localhost:2990/jira/rest/" + url).queryParams(query);

        Builder b = r.accept(MediaType.APPLICATION_JSON_TYPE, MediaType.APPLICATION_XML_TYPE);

        // just copy all cookies from the original request.
        for(Cookie c:req.getCookies()) {
            b.cookie(new javax.ws.rs.core.Cookie(c.getName(),c.getValue(),c.getPath(),c.getDomain(),c.getVersion()));
        }

        ClientResponse response = b.get(ClientResponse.class);
        return response.getEntity(cls);
    }

    private List<Issue> getIssues(HttpServletRequest req) {
        User user = getCurrentUser(req).getDirectoryUser();

        JqlClauseBuilder jqlClauseBuilder = JqlQueryBuilder.newClauseBuilder();
        com.atlassian.query.Query query = jqlClauseBuilder.project("MOB").buildQuery();
        PagerFilter pagerFilter = PagerFilter.getUnlimitedFilter();
        com.atlassian.jira.issue.search.SearchResults searchResults = null;
        try {
            searchResults = searchService.search(user, query, pagerFilter);
        } catch (SearchException e) {
            e.printStackTrace();
        }
        return searchResults.getIssues();
    }

    private List<Issue> getSprintIssues(User user, String project, String sprint) {
        JqlClauseBuilder jqlClauseBuilder = JqlQueryBuilder.newClauseBuilder();

        com.atlassian.query.Query query = jqlClauseBuilder
                .customField(fieldManager.getCustomFieldObjectByName("Sprint").getIdAsLong()).eq(sprint)
                .and().project(project).buildQuery();

        PagerFilter pagerFilter = PagerFilter.getUnlimitedFilter();
        com.atlassian.jira.issue.search.SearchResults searchResults = null;
        try {
            searchResults = searchService.search(user, query, pagerFilter);
        } catch (SearchException e) {
            e.printStackTrace();
        }
        return searchResults.getIssues();
    }

    private ApplicationUser getCurrentUser(HttpServletRequest req) {
        return jiraUserManager.getUserByName(userManager.getRemoteUsername(req));
    }
}