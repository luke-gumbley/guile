package com.atlassian.plugins.guile.rest;

import com.atlassian.crowd.embedded.api.User;
import com.atlassian.jira.bc.issue.IssueService;
import com.atlassian.jira.bc.issue.search.SearchService;
import com.atlassian.jira.issue.Issue;
import com.atlassian.jira.issue.search.SearchException;
import com.atlassian.jira.jql.builder.JqlClauseBuilder;
import com.atlassian.jira.jql.builder.JqlQueryBuilder;
import com.atlassian.jira.security.JiraAuthenticationContext;
import com.atlassian.jira.web.bean.PagerFilter;
import com.atlassian.sal.api.user.UserManager;
//import com.atlassian.jira.user.util.UserManager;
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

    public MyRestResource(JiraAuthenticationContext jiraAuthenticationContext, IssueService issueService,
                          SearchService searchService, UserManager userManager,
                          com.atlassian.jira.user.util.UserManager jiraUserManager)
    {
        this.issueService = issueService;
        this.searchService = searchService;
        this.jiraAuthenticationContext = jiraAuthenticationContext;
        this.userManager = userManager;
        this.jiraUserManager = jiraUserManager;
    }

    @GET
    @AnonymousAllowed
    @Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
    public Response getMessage(@Context HttpServletRequest request)
    {
        IssueService.IssueResult issue = issueService.getIssue(getCurrentUser(request), "MOB-1");
        String output = "request was " + request.getMethod();
        output += " user is " + userManager.getRemoteUsername(request);
        if(issue != null)
            output += " description is " + issue.getIssue().getDescription();
        else
            output += " issue is null";
        List<Issue> issues = getIssues(request);
        if(issues != null)
            output += " "  + issues.size() + " issue(s) in project ";
        else
            output += " unable to get list of issues";

        return Response.ok(new MyRestResourceModel(output)).build();
    }

    private List<Issue> getIssues(HttpServletRequest req) {
        // User is required to carry out a search
        User user = getCurrentUser(req);

        // search issues

        // The search interface requires JQL clause... so let's build one
        JqlClauseBuilder jqlClauseBuilder = JqlQueryBuilder.newClauseBuilder();
        // Our JQL clause is simple project="TUTORIAL"
        com.atlassian.query.Query query = jqlClauseBuilder.project("MOB").buildQuery();
        // A page filter is used to provide pagination. Let's use an unlimited filter to
        // to bypass pagination.
        PagerFilter pagerFilter = PagerFilter.getUnlimitedFilter();
        com.atlassian.jira.issue.search.SearchResults searchResults = null;
        try {
            // Perform search results
            searchResults = searchService.search(user, query, pagerFilter);
        } catch (SearchException e) {
            e.printStackTrace();
        }
        // return the results
        return searchResults.getIssues();
    }

    private User getCurrentUser(HttpServletRequest req) {
        // To get the current user, we first get the username from the session.
        // Then we pass that over to the jiraUserManager in order to get an
        // actual User object.
        return jiraUserManager.getUser(userManager.getRemoteUsername(req));
    }
}