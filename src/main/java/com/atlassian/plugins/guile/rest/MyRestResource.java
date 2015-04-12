package com.atlassian.plugins.guile.rest;

import com.atlassian.crowd.embedded.api.User;
import com.atlassian.jira.bc.issue.IssueService;
import com.atlassian.jira.bc.issue.search.SearchService;
import com.atlassian.jira.issue.CustomFieldManager;
import com.atlassian.jira.issue.Issue;
import com.atlassian.jira.issue.MutableIssue;
import com.atlassian.jira.issue.fields.CustomField;
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
import javax.ws.rs.core.Response;
import java.util.List;
import com.sun.jersey.api.client.*;
import com.sun.jersey.api.client.WebResource.Builder;
import com.sun.jersey.api.client.config.ClientConfig;
import com.sun.jersey.api.client.config.DefaultClientConfig;
import com.sun.jersey.api.json.JSONConfiguration;
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

    public MyRestResource(JiraAuthenticationContext jiraAuthenticationContext, IssueService issueService,
                          SearchService searchService, CustomFieldManager fieldService, UserManager userManager,
                          com.atlassian.jira.user.util.UserManager jiraUserManager) {
        this.issueService = issueService;
        this.searchService = searchService;
        this.jiraAuthenticationContext = jiraAuthenticationContext;
        this.userManager = userManager;
        this.jiraUserManager = jiraUserManager;
        this.fieldManager = fieldService;
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
    @Path("sprints")
    public Response getSprints(@Context HttpServletRequest request, @DefaultValue("0") @QueryParam("id") long id, @DefaultValue("") @QueryParam("name") String name) {
        ApplicationUser user = getCurrentUser(request);

        if(id == 0) {
            // find matching board name
            BoardModel[] boards = executeCall(request,boardResponse.class,"greenhopper/1.0/rapidview").boards;
            for(int i = 0; i < boards.length ; i++)
                if(boards[i].getName().equals(name)) {
                    id = boards[i].getId();
                    i = boards.length;
                }
        }

        SprintModel[] sprints = id == 0
            ? new SprintModel[0]
            : executeCall(request,sprintResponse.class,"greenhopper/1.0/sprintquery/" + id).sprints;

        return Response.ok(new GetSprintsModel(sprints)).build();
    }

    private String executeCall(HttpServletRequest req, String url) {
        return executeCall(req, String.class, url);
    }

    private <T> T executeCall(HttpServletRequest req, Class<T> cls, String url) {
        ClientConfig clientConfig = new DefaultClientConfig();
        clientConfig.getFeatures().put(JSONConfiguration.FEATURE_POJO_MAPPING, Boolean.TRUE);
        Client client = Client.create(clientConfig);

        WebResource r = client.resource("http://localhost:2990/jira/rest/" + url);

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