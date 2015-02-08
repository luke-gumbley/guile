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

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.*;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.util.List;

/**
 * A resource of message.
 */
@Path("/message")
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

        return Response.ok(new MyRestResourceModel(output)).build();
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