package com.atlassian.plugins.guile.rest;

import com.atlassian.crowd.embedded.api.User;
import com.atlassian.jira.issue.IssueManager;
import com.atlassian.jira.bc.issue.search.SearchService;
import com.atlassian.jira.issue.CustomFieldManager;
import com.atlassian.jira.issue.Issue;
import com.atlassian.jira.issue.MutableIssue;
import com.atlassian.jira.issue.changehistory.ChangeHistory;
import com.atlassian.jira.issue.changehistory.ChangeHistoryManager;
import com.atlassian.jira.issue.customfields.CustomFieldType;
import com.atlassian.jira.issue.fields.CustomField;
import com.atlassian.jira.issue.fields.FieldManager;
import com.atlassian.jira.issue.fields.NavigableField;
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
import java.time.*;
import java.time.format.DateTimeFormatter;
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

	private final IssueManager issueManager;
	private final JiraAuthenticationContext jiraAuthenticationContext;
	private final UserManager userManager;
	private final com.atlassian.jira.user.util.UserManager jiraUserManager;
	private final SearchService searchService;
	private final CustomFieldManager customFieldManager;
	private final FieldManager fieldManager;
	private final ChangeHistoryManager historyManager;

	public MyRestResource(JiraAuthenticationContext jiraAuthenticationContext, IssueManager issueManager,
						  SearchService searchService, CustomFieldManager customFieldManager, FieldManager fieldManager,
						  UserManager userManager, com.atlassian.jira.user.util.UserManager jiraUserManager,
						  ChangeHistoryManager historyManager) {
		this.issueManager = issueManager;
		this.searchService = searchService;
		this.jiraAuthenticationContext = jiraAuthenticationContext;
		this.userManager = userManager;
		this.jiraUserManager = jiraUserManager;
		this.customFieldManager = customFieldManager;
		this.fieldManager = fieldManager;
		this.historyManager = historyManager;
	}

	@GET
	@AnonymousAllowed
	@Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	@Path("message")
	public Response getMessage(@Context HttpServletRequest request) {
		ApplicationUser user = getCurrentUser(request);


		String output = "request was " + request.getMethod();
		output += " user is " + userManager.getRemoteUsername(request);

		MutableIssue issue = issueManager.getIssueObject("MOB-1");

		output += issue != null
			? " description is " + issue.getDescription()
			: " issue is null";

		for(NavigableField field:fieldManager.getNavigableFields()) {
			output += " " + field.getId();
		}

		CustomField sprint = customFieldManager.getCustomFieldObjectByName("Sprint");
		if(sprint != null)
			output += " SPRINT ID IS (" + sprint.getIdAsLong() + ")";

		List<Issue> issues = getSprintIssues(user.getDirectoryUser(),"MOB","Sprint 1");
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
		public sprintIssueContents contents;
	}

   	@JsonIgnoreProperties(ignoreUnknown = true)
	private static class sprintModel {
		public int id;
		public String name;
		public String startDate;
		public String endDate;
		public String completeDate;
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	private static class sprintModelResponse {
		public sprintModel sprint;
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	private static class ratesResponse {
		public String timezone;
		@JsonProperty("rates")
		public PeriodModel[] periods;
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

	private String getCustomFieldValue(CustomField field, Issue issue) {
		// Horrific. Custom fields are awful. Any other approach leads to more suppression.
		@SuppressWarnings("unchecked") CustomFieldType<?, Object> fieldType = field.getCustomFieldType();
		Object val = fieldType.getValueFromIssue(field, issue);

		Collection<Object> values = new ArrayList<>();

		if(Collection.class.isInstance(val)) {
			//noinspection unchecked Relies on knowledge of the operation of CustomFieldType.
			values = (Collection<Object>)val;
		} else if(Map.class.isInstance(val)) {
			for (Object o : ((Map)val).values()) {
				if (Collection.class.isInstance(o))
					values.addAll((Collection)o);
				else
					values.add(o);
			}
		} else if(val != null) {
			values.add(val);
		}

		List<String> output = new ArrayList<>();
		for(Object o: values) {
			output.add(fieldType.getStringFromSingularObject(o));
		}

		return output.size() > 0 ? String.join(", ", output) : "";
	}

	private String getSystemFieldValue(String field, Issue issue) {
		//noinspection deprecation see todo.
		return field.equals("Parent Issue")
			? getParent(issue)
			// Note: Doesn't work for all fields, only simple fields still using historic storage.
			// TODO: abstract this and 'fieldIrrelevant' into custom field accessor classes
			: issue.getString(field);
	}

	private String getParent(Issue issue) {
		Issue parent = issue.getParentObject();
		return parent == null ? "" : parent.getKey();
	}

	private static Map<Boolean, Collection<String>> fieldIrrelevant = null;

	private static void setupRelevance() {
		fieldIrrelevant = new HashMap<>();
		fieldIrrelevant.put(true, new ArrayList<String>());
		fieldIrrelevant.put(false, new ArrayList<String>());

		// subTask
		fieldIrrelevant.get(true).add("Sprint");

		// issue
		fieldIrrelevant.get(false).add("Parent Issue");
	}

	private static boolean isFieldRelevant(String field, Issue issue) {
		if(fieldIrrelevant == null) setupRelevance();

		return !fieldIrrelevant.get(issue.isSubTask()).contains(field);
	}

	private Map<String, List<ChangeModel>> getIssueChanges(User user, String issueId, Timestamp since, List<String> fields) {
		return getIssueChanges(user, issueId, since, null, fields);
	}

	private Map<String, List<ChangeModel>> getIssueChanges(User user, String issueId, Timestamp since, Timestamp before, List<String> fields) {
		MutableIssue issue = issueManager.getIssueObject(issueId);
		fields = fields == null ? new ArrayList<String>() : fields;

		Map<String, List<ChangeModel>> changes = new Hashtable<>();

		if(issue != null) {
			// TODO: investigate the potential for using historyManager.getChangeHistoriesForUser
			List<ChangeHistory> histories = new ArrayList<>(historyManager.getChangeHistoriesSince(issue, since));

			Collections.sort(histories, new Comparator<ChangeHistory>() {
				@Override
				public int compare(ChangeHistory o1, ChangeHistory o2) {
					return o1.getTimePerformed().compareTo(o2.getTimePerformed());
				}
			});

			for(ChangeHistory history:histories) {
				for(ChangeItemBean change:history.getChangeItemBeans()) {
					// Note: Does not necessarily correspond to a system field Id (e.g. "Parent Issue").
					String field = change.getField();
					if(fields.size() > 0 && !fields.contains(field)) continue;
					if(before != null && change.getCreated().compareTo(before) > 0) continue;

					ChangeModel c = new ChangeModel(change.getCreated(),
							history.getAuthorObject().getKey(),
							// Sometimes getToString has a value but getTo does not.
							// Some fields populate both but give different values (e.g. Sprint).
							change.getTo() == null ? change.getToString() : change.getTo());

					// If this is the first change logged for this field, add the previous field value
					// timestamped at the later of the issue creation date or the 'since' parameter
					if(!changes.containsKey(field)) {
						List<ChangeModel> originalChange = new ArrayList<>();
						Timestamp originalTime = issue.getCreated().compareTo(since) > 0 ? issue.getCreated() : since;
						// if 'since' has been defined, note that the previous change may not have been by the creator.
						originalChange.add(new ChangeModel(originalTime, issue.getCreatorId(), change.getFrom() == null ? change.getFromString() : change.getFrom()));
						changes.put(field, originalChange);
					}

					changes.get(field).add(c);
				}
			}

			// Add current values for all fields unchanged over that time period.
			List<String> unchanged = new ArrayList<>(fields);
			unchanged.removeAll(changes.keySet());
			for(String field:unchanged) {
				if(!isFieldRelevant(field,issue)) continue;

				Collection<CustomField> customFields = customFieldManager.getCustomFieldObjectsByName(field);
				Object val = !customFields.isEmpty()
					? getCustomFieldValue(customFields.iterator().next(), issue)
					: getSystemFieldValue(field,issue);

				List<ChangeModel> originalChange = new ArrayList<>();
				Timestamp originalTime = issue.getCreated().compareTo(since) > 0 ? issue.getCreated() : since;
				// if 'since' has been defined, note that the previous change may not have been by the creator.
				originalChange.add(new ChangeModel(originalTime, issue.getCreatorId(), val == null ? "" : val.toString()));
				changes.put(field, originalChange);
			}
		}

		return changes;
	}

	@GET
	@AnonymousAllowed
	@Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	@Path("issue/{issueId}/changes")
	public Response getChanges(@Context HttpServletRequest request, @PathParam("issueId") String issueId, @DefaultValue("1970-01-01 00:00:00") @QueryParam("since") Timestamp since) {
		ApplicationUser user = getCurrentUser(request);
		return Response.ok(new GetChangesModel(getIssueChanges(user.getDirectoryUser(), issueId, since, null))).build();
	}

	private List<IssueModel> getSprintIssues(HttpServletRequest request, long boardId, long sprintId, boolean includeTasks) {
		MultivaluedMap<String, String> query = new MultivaluedMapImpl();
		query.add("rapidViewId",Long.toString(boardId));
		query.add("sprintId",Long.toString(sprintId));

		sprintIssueResponse response = executeCall(request, sprintIssueResponse.class, "greenhopper/1.0/rapid/charts/sprintreport",query);

		List<IssueModel> issues = new ArrayList<>();
		Collections.addAll(issues,response.contents.completedIssues);
		Collections.addAll(issues,response.contents.incompletedIssues);
		Collections.addAll(issues,response.contents.puntedIssues);
		// Sigh, JIRA does not support JDK 8 plugins yet.
		//List<Long> ids=issues.stream().map(x -> x.getId()).collect(Collectors.toList());
		List<Long> ids = new ArrayList<>();
		for(IssueModel issue: issues) { ids.add(issue.getId()); }

		if(includeTasks) {
			List<Issue> issueObjects = issueManager.getIssueObjects(ids);
			for(Issue issue: issueObjects) {
				Collection<Issue> subTasks = issue.getSubTaskObjects();
				for(Issue subTask: subTasks) {
					issues.add(new IssueModel(subTask.getId(),subTask.getKey()));
				}
			}
		}
		return issues;
	}

	// Unbelievably, the GreenHopper workday API returns epoch timestamps that they have munged to a particular timezone.
	// This while the sprint model returns server-local date time strings with no timezone info.
	private Timestamp unmungeTimestamp(Timestamp stamp, String timezone) {
		DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss.S");
		String corrected = formatter.withZone(ZoneId.of("UTC")).format(stamp.toLocalDateTime().atZone(ZoneId.of(timezone)));
		return Timestamp.valueOf(LocalDateTime.parse(corrected,formatter));
	}

	@GET
	@AnonymousAllowed
	@Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	@Path("boards/{boardId}/sprints/{sprintId}")
	public Response getSprint(@Context HttpServletRequest request, @PathParam("boardId") long boardId, @PathParam("sprintId") long sprintId) {
		sprintModel sprint = executeCall(request, sprintModelResponse.class, "greenhopper/1.0/sprint/" + Long.toString(sprintId) + "/edit/model").sprint;

		DateTimeFormatter formatter = DateTimeFormatter
			.ofPattern("dd/MMM/yy h:mm a")
			.withZone(ZoneId.of("Pacific/Auckland"));

		Timestamp start = Timestamp.valueOf(LocalDateTime.parse(sprint.startDate, formatter));
		Timestamp end = Timestamp.valueOf(LocalDateTime.parse(sprint.endDate, formatter));
 		Timestamp complete = Timestamp.valueOf(LocalDateTime.parse(sprint.completeDate, formatter));

		MultivaluedMap<String, String> query = new MultivaluedMapImpl();
		query.add("rapidViewId",Long.toString(boardId));
		query.add("startDate",Long.toString(start.getTime()));
		query.add("endDate",Long.toString(end.getTime()));
		ratesResponse response = executeCall(request, ratesResponse.class, "greenhopper/1.0/rapidviewconfig/workingdays/rates", query);

		for(int i=0;i<response.periods.length;i++) {
			response.periods[i].setStart(unmungeTimestamp(response.periods[i].getStart(),response.timezone));
			response.periods[i].setEnd(unmungeTimestamp(response.periods[i].getEnd(), response.timezone));
		}

		return Response.ok(new GetSprintModel(sprint.id, sprint.name, start, end, complete, response.periods)).build();
	}

	@GET
	@AnonymousAllowed
	@Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	@Path("boards/{boardId}/sprints/{sprintId}/issues")
	public Response getSprintIssues(@Context HttpServletRequest request, @PathParam("boardId") long boardId, @PathParam("sprintId") long sprintId) {
		List<IssueModel> issues = getSprintIssues(request, boardId, sprintId, true);
		return Response.ok(new GetSprintIssuesModel(issues.toArray(new IssueModel[issues.size()]))).build();
	}

	@GET
	@AnonymousAllowed
	@Produces({MediaType.APPLICATION_JSON, MediaType.APPLICATION_XML})
	@Path("boards/{boardId}/sprints/{sprintId}/changes")
	public Response getSprintChanges(@Context HttpServletRequest request, @PathParam("boardId") long boardId, @PathParam("sprintId") long sprintId, @DefaultValue("1970-01-01 00:00:00") @QueryParam("since") Timestamp since, @QueryParam("fields") List<String> fields) {
		List<IssueModel> issues = getSprintIssues(request, boardId, sprintId, true);

		Map<String, Map<String, List<ChangeModel>>> changes = new Hashtable<>();

		User user = getCurrentUser(request).getDirectoryUser();
		for(IssueModel issue:issues) {
			Map<String, List<ChangeModel>> issueChanges = getIssueChanges(user,issue.getKey(),since,fields);
			for(String field: issueChanges.keySet()) {
				if(!changes.containsKey(field))
					changes.put(field,new Hashtable<String, List<ChangeModel>>());
				changes.get(field).put(issue.getKey(),issueChanges.get(field));
			}
		}

		return Response.ok(new GetSprintChangesModel(changes)).build();
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
		List<Issue> issues = new ArrayList<>();
		try {
			issues = searchService.search(user, query, pagerFilter).getIssues();
		} catch (SearchException e) {
			e.printStackTrace();
		}
		return issues;
	}

	private List<Issue> getSprintIssues(User user, String project, String sprint) {
		JqlClauseBuilder jqlClauseBuilder = JqlQueryBuilder.newClauseBuilder();

		com.atlassian.query.Query query = jqlClauseBuilder
				.customField(customFieldManager.getCustomFieldObjectByName("Sprint").getIdAsLong()).eq(sprint)
				.and().project(project).buildQuery();

		PagerFilter pagerFilter = PagerFilter.getUnlimitedFilter();
		List<Issue> issues = new ArrayList<>();
		try {
			issues = searchService.search(user, query, pagerFilter).getIssues();
		} catch (SearchException e) {
			e.printStackTrace();
		}
		return issues;
	}

	private ApplicationUser getCurrentUser(HttpServletRequest req) {
		return jiraUserManager.getUserByName(userManager.getRemoteUsername(req));
	}
}