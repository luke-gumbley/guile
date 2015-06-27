GADGET = {
	initialized: false,

	ajax: function(settings) {
		var deferred = AJS.$.Deferred();
		settings.success = function() {deferred.resolveWith(this,arguments);};
		settings.error = function() {deferred.rejectWith(this,arguments);};
		return deferred.promise(AJS.$.ajax(settings));
	},

	templateArgs: [{
		key: 'sprintData',
		ajaxOptions: function() {
			return {
				url: '/rest/greenhopper/1.0/sprint/' + this.getPref('sprint') + '/edit/model',
				contentType: 'application/json'
			};
		}
	},{
		key: 'issueData',
		ajaxOptions: function() {
			return {
				url: '/rest/guile/1.0/boards/' + this.getPref('board') + '/sprints/' + this.getPref('sprint') + '/changes',
				data: {
					fields: ['Sprint','Parent Issue','timeestimate','timeoriginalestimate','timespent']
				},
				contentType: 'application/json'
			};
		}
	}],

	template: function (args) {
		var gadget=this;
		var ratioPref = gadget.getPref('aspectRatio').split(':')
		var ratio = ratioPref[0] / ratioPref[1];
		var view = gadget.getView();
		args.width = view.width();
		args.height = args.width/ratio;
		if(!GADGET.initialized) {
			view.svg({
				onLoad: function(svg) { GADGET.render(svg,args); },
				settings: { width: args.width, height: args.height }
			});
			GADGET.initialized = true;
		} else {
			GADGET.render(view.svg('get')
				.clear()
				.configure({width: args.width, height: args.height}), args);
		}
	},

	updateSprintList: function(boardId, sprintFieldId) {
		var ajax = AJS.$.ajax({
			url: '/rest/greenhopper/1.0/sprintquery/' + boardId,
			data: {
				includeFutureSprints: false
			},
			contentType: 'application/json',
			success: function(response) {
				var options=AJS.$.map(response.sprints, function(sprint) {
					return AJS.$("<option/>").attr("value", sprint.id).text(sprint.name).get();
				});

				AJS.$('#' + sprintFieldId)
					.empty()
					.append(options)
					.val(gadget.getPref('sprint'))
			}
		});
	},

	descriptor: function(args) {
		return {
			action: "",
			theme: "long-label", //top-label
			fields:[{
				id: "board-select",
				userpref: 'board',
				label: 'Board',
				type: "select",
				selected: gadget.getPref("board"),
				options: args.rapidview.views.map(function(board) {return {label:board.name,value:board.id};})
			}, {
				id: 'sprint-parent',
				userpref: 'sprint',
				label: 'Sprint',
				type: "callbackBuilder",
				callback: function (parentDiv) {
					var sprintFieldId='sprint-select';

					var sprintField = AJS.$("<select>").attr({id:sprintFieldId,name:'sprint'}).addClass('select');
					parentDiv.append(sprintField);

					var boardField = AJS.$('#board-select');
					var boardId=boardField.find('option:selected').attr('value');
					GADGET.updateSprintList(boardId, sprintFieldId);

					boardField.change(function(event){
						var boardId=AJS.$(event.target).find('option:selected').attr('value');
						GADGET.updateSprintList(boardId, sprintFieldId)
					});
				}
			}, {
				userpref: 'aspectRatio',
				label: 'Aspect Ratio',
				type: 'text',
				value: gadget.getPref('aspectRatio')
			}, {
                id: 'plots',
                userpref: 'plots',
                label: 'Plots',
                type: "callbackBuilder",
                callback: function (parentDiv) {
					var plots = GADGET.getPlots();

                    var plotField = AJS.$('<input>')
                        .attr({id:'plot-field',type:'hidden',name:'plots'})
                        .val(JSON.stringify(plots));
					parentDiv.append(plotField);

					var addButton = AJS.$('<span />')
                        .addClass('aui-icon aui-icon-small aui-iconfont-add')
                        .css('margin','7px 0px 7px 254px');
					var addPlot = AJS.$('<div />')
						.attr({id: 'addPlot'})
						.append(addButton)
						.click(function() { GADGET.addPlot(); });
					parentDiv.append(addPlot);

					plots.forEach(function(plot) { GADGET.addPlot(plot); });
                }
            },
			AJS.gadget.fields.nowConfigured()]
		};
	},

	getPlots: function() {
        // God only knows why gadget.getPrefs().getString escapes the string before returning it.
		var plots = JSON.parse(gadgets.util.unescapeString(gadget.getPref('plots')));
		return AJS.$.isArray(plots) ? plots : [];
	},

	updatePlots: function() {
		var parentDiv = AJS.$('div#plots');

		var plotFields = parentDiv.children('.plotfields');

		var plots = plotFields.map(function(i,plot) {
			var plotDiv = AJS.$(plot);
			return {
				expr: plotDiv.children('.expr').val(),
				colour: plotDiv.children('.colour').val()
			};
		}).get();

		AJS.$('#plot-field').val(JSON.stringify(plots));
	},

	addPlot: function(plot) {
		var parentDiv = AJS.$('div#plots');
		var addPlot = parentDiv.children('#addPlot');

		var plotDiv = AJS.$('<div />')
			.addClass('plotfields')
			.css('margin-top','5px');

		var exprInput = AJS.$('<input>')
			.attr({type:'text'})
			.addClass('expr text medium-field')
			.css('margin-right','10px')
			.val(plot ? (plot.expr || '') : '')
            .change(GADGET.updatePlots)
		var colourInput = AJS.$('<input>')
			.attr({type:'text'})
			.addClass('colour text short-field')
			.val(plot ? (plot.colour || '') : '')
            .change(GADGET.updatePlots)
		var removePlot = AJS.$('<span />')
			.addClass('aui-icon aui-icon-small aui-iconfont-close-dialog')
			.css('margin-left','4px')
			.click(GADGET.removePlot);
		plotDiv.append(exprInput);
		plotDiv.append(colourInput);
		plotDiv.append(removePlot);

		addPlot.before(plotDiv);

		if(!plot) {
			GADGET.updatePlots();
			gadget.resize();
		}
	},

	removePlot: function(event) {
		AJS.$(event.target).parent().remove();
		GADGET.updatePlots();
        gadget.resize();
	},

	relevant: function(issues, sprint) {
		return Object.keys(issues)
			.map(function(key) { return issues[key]; })
			.filter(function(issue) {
				// only issues in the sprint
				return (issue['Parent Issue'] === undefined && issue['Sprint'] == sprint)
					// or subtasks with a parent in the sprint
					|| (issues[issue['Parent Issue']] !== undefined && issues[issue['Parent Issue']]['Sprint'] == sprint);
			})
	},

	simulate: function(sprintId, start, complete, plots, events) {
		var max = undefined;

		// ensure a default is set for every variable required for every plot
		var defaults = {};
		plots.forEach(function(plot) {
			plot.variables.forEach(function(variable) {
				defaults[variable] = 0;
			});
		});

		// start with no knowledge of any issues...
		var issues = {};

		// and build issue knowledge with each event
		events.forEach(function(event) {
			// calculate and post the opening total for each plot, once all pre-sprint events have been processed.
			if(max === undefined && event.date > start) {
				max = 0;
				// only issues in the sprint or with a parent in the sprint are relevant
				var relevant = GADGET.relevant(issues, sprintId);
				plots.forEach(function(plot) {
					plot.y = plot.aggregate(relevant);
					if(plot.y > max) max = plot.y;
					plot.points = [[0, plot.y]];
				});
			}

			// update the issue records with information from this event
			if(issues[event.issue] === undefined)
				issues[event.issue] = AJS.$.extend({}, defaults);
			issues[event.issue][event.field] = event.value;

			// if within the sprint
			if(event.date > start) {
				var relevant = GADGET.relevant(issues, sprintId);
				var x = event.date - start;
				plots.forEach(function(plot) {
					var y = plot.aggregate(relevant);
					// and a transition occurred
					if(y !== plot.y) {
						// plot that transition.
						plot.points.push([x, plot.y], [x, y]);
						plot.y = y;
						if(y > max) max = y;
					}
				});
			}
		});

		var x = complete - start;
		plots.forEach(function(plot) {
			plot.points.push([x, plot.y])
		});

		return max;
	},

	render: function(svg, args) {
		var start = new Date(args.sprintData.sprint.startDate).getTime();
		var end = new Date(args.sprintData.sprint.endDate).getTime();
		var complete = new Date(args.sprintData.sprint.completeDate).getTime();
		var sprintId = args.sprintData.sprint.id;

		var plots = GADGET.getPlots();

		plots.forEach(function(plot) {
			plot.line = {
				fill: 'none',
				stroke: plot.colour,
				'stroke-opacity': 0.5,
				strokeWidth: 2
			};

			plot.expr = math.parse(plot.expr);
			plot.variables = plot.expr
				.filter(function(node) { return node.type === 'SymbolNode'; })
				.map(function(node) { return node.name; });
			plot.expr = plot.expr.compile(math);

			plot.aggregate = function(issues) {
				var self = this;
				return issues.reduce(function(total, issue) {
					return total += self.expr.eval(issue);
				}, 0);
			}

		});

		// Flatten JSON event hierarchy
		var events = [];
		for(field in args.issueData.changes) {
			for(issue in args.issueData.changes[field]) {
				args.issueData.changes[field][issue].forEach(function(event) {
					event.field = field;
					event.issue = issue;
					// parse as a float if possible, math.js can work with strings though so don't rule out crazy stuff.
					var value = event.value === "" ? 0 : parseFloat(event.value);
					event.value = isNaN(value) ? event.value : value;
					events.push(event);
				})
			}
		}
		events.sort(function(a,b) {return a.date - b.date;});

		var max = GADGET.simulate(sprintId, start, complete, plots, events);

		var left = 20;
		var top = 20;
		var right = args.width - 40;
		var bottom = args.height - 40;

		var xScale = (right - left) / (end - start);
		var yScale = (top - bottom) / max;

		plots.forEach(function(plot) {
			plot.points.forEach(function(point) {
				point[0] = point[0] * xScale + left;
				point[1] = point[1] * yScale + bottom;
			});

			svg.polyline(plot.points, plot.line);
		});
	}
};