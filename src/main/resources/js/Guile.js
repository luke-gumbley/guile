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
		var width = view.width();
		if(!GADGET.initialized) {
			view.svg({
				onLoad: function(svg) { GADGET.render(svg,args); },
				settings: { width: width, height: width/ratio }
			});
			GADGET.initialized = true;
		} else {
			GADGET.render(view.svg('get')
				.clear()
				.configure({width: width, height: width/ratio}), args);
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
			//action: "validation url",
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
                    // God only knows why gadget.getPrefs().getString escapes the string before returning it.
					var plots=JSON.parse(gadgets.util.unescapeString(gadget.getPref('plots')));
					plots = AJS.$.isArray(plots) ? plots : [];
					plots.forEach(function(plot,i) {
						var plotDiv = AJS.$('<div />');
						var exprInput = AJS.$('<input type="text">')
							.attr('id','plotexpr' + i)
							.addClass('text')
							.addClass('medium-field')
							.css('margin-right','10px')
							.val(plot.expr || '');
						var colourInput = AJS.$('<input type="text">')
							.attr('id','plotcolor' + i)
							.addClass('text')
							.addClass('short-field')
							.val(plot.colour || '');
						var removePlot = AJS.$('<span />')
							.addClass('aui-icon')
							.addClass('aui-icon-small')
							.addClass('aui-iconfont-close-dialog')
							.css('margin-left','4px');
						plotDiv.append(exprInput);
						plotDiv.append(colourInput);
						plotDiv.append(removePlot);
						parentDiv.append(plotDiv);
					});
					var addDiv = AJS.$('<div />');
					var addPlot = AJS.$('<span />')
						.addClass('aui-icon')
						.addClass('aui-icon-small')
						.addClass('aui-iconfont-add')
						.css('margin','7px 0px 7px 254px');
					addDiv.append(addPlot);
					parentDiv.append(addDiv);

					//gadget.savePref()
                }
            },
			AJS.gadget.fields.nowConfigured()]
	};
},

/*
		var expr = math.parse('timeestimate');
		var variables = expr.filter(function(node) { return node.type === 'SymbolNode'; }).map(function(node) { return node.name; })
		expr.compile(math).eval({'timeestimate':3});
*/

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
		var issues = {};

		events.forEach(function(event) {
			// calculate and post the opening total for each plot
			if(max === undefined && event.date > start) {
				max = 0;
				var relevant = GADGET.relevant(issues, sprintId);
				plots.forEach(function(plot) {
					plot.y = plot.aggregate(relevant);
					if(plot.y > max) max = plot.y;
					plot.points = [[0, plot.y]];
				});
			}

			// update the issue records
			if(issues[event.issue] === undefined)
				issues[event.issue] = {};
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

		var plots = [{
			line: {
				fill: 'none',
				stroke: 'red',
				'stroke-opacity': 0.5,
				strokeWidth: 2
			},

			aggregate: function(issues) {
				return issues.reduce(function(total, issue) { return total+=parseInt(issue['timeestimate'] || '0'); }, 0);
			}
		}, {
			line: {
				fill: 'none',
				stroke: 'blue',
				'stroke-opacity': 0.5,
				strokeWidth: 2
			},

			aggregate: function(issues) {
				return issues.reduce(function(total, issue) { return total+=parseInt(issue['timeoriginalestimate'] || '0'); }, 0);
			}
		}, {
            line: {
                fill: 'none',
                stroke: 'green',
                'stroke-opacity': 0.5,
                strokeWidth: 2
            },

            aggregate: function(issues) {
                return issues.reduce(function(total, issue) { return total+=parseInt(issue['timespent'] || '0'); }, 0);
            }
        }];

		// Flatten JSON event hierarchy
		var events = [];
		for(field in args.issueData.changes) {
			for(issue in args.issueData.changes[field]) {
				args.issueData.changes[field][issue].forEach(function(event) {
					event.field = field;
					event.issue = issue;
					events.push(event);
				})
			}
		}
		events.sort(function(a,b) {return a.date - b.date;});

		var max = GADGET.simulate(sprintId, start, complete, plots, events);

		var left = 20;
		var top = 20;
		var right = svg.width() - 40;
		var bottom = svg.height() - 40;

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