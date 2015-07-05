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
				url: '/rest/guile/1.0/boards/' + this.getPref('board') + '/sprints/' + this.getPref('sprint'),
				contentType: 'application/json'
			};
		}
	},{
		key: 'issueData',
		ajaxOptions: function() {
			var variables = AJS.$.map(GADGET.getPlots(this), function(plot) {
				return GADGET.parseExpression(plot.expr).variables;
			});

			return {
				url: '/rest/guile/1.0/boards/' + this.getPref('board') + '/sprints/' + this.getPref('sprint') + '/changes',
				data: {
					fields: AJS.$.unique(['Sprint','Parent Issue'].concat(variables))
				},
				contentType: 'application/json'
			};
		}
	}],

	template: function (args) {
		var view = this.getView();
		if(!GADGET.initialized) {
			view.svg({ onLoad: function(svg) { GADGET.render(svg,args); } });
			GADGET.initialized = true;
		} else {
			GADGET.render(view.svg('get').clear(), args);
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
				userpref: 'timeAxis',
				label: 'Time Axis',
				description: 'Choose how to render sprint periods with modified work rate (e.g. non-working days)',
				type: 'select',
				selected: gadget.getPref('timeAxis'),
				options: [{
					label: "Hide non-working days",
					value: "nonZeroWork"
				}, {
					label: "Constant Time",
					value: "constantTime"
				}, {
					label: "Constant Work",
					value: "constantWork"
				}]
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
            }, {
                id: 'idealPlot',
                userpref: 'idealPlot',
                label: 'Ideal line',
                type: "callbackBuilder",
                callback: function (parentDiv) {
                    var idealField = AJS.$('<select>')
                        .attr({id:'ideal-field',name:'idealPlot'})
                        .addClass('select');
					parentDiv.append(idealField);

					var plots = GADGET.getPlots();
					GADGET.populateIdeal(plots);
					var idealPlot = gadget.getPref('idealPlot');
					if(plots[idealPlot] === undefined) idealPlot = "";
					idealField.val(idealPlot);
                }
            },
			AJS.gadget.fields.nowConfigured()]
		};
	},

	populateIdeal: function(plots) {
		var idealField = AJS.$('#ideal-field');
		var value = idealField.val();

		idealField
			.empty()
			.append(AJS.$('<option />', { text:'Off', value: '' }))
			.append(AJS.$.map(plots, function(plot, index) {
				return AJS.$('<option />', { text:plot.expr, value: index }).get();
			}))
			.val(value);
	},

	getPlots: function(gadgetObj) {
        // God only knows why gadget.getPrefs().getString escapes the string before returning it.
		var plots = JSON.parse(gadgets.util.unescapeString((gadgetObj || gadget).getPref('plots')));
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

		GADGET.populateIdeal(plots);
	},

	addPlot: function(plot) {
		var parentDiv = AJS.$('div#plots');
		var addPlot = parentDiv.children('#addPlot');

		var plotDiv = AJS.$('<div />')
			.addClass('plotfields')
			.css('margin-bottom','5px');

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
		var plotField = AJS.$(event.target).parent();
		var idealField = AJS.$('#ideal-field');

		var plotIndex = plotField.index() - 1;
		var idealIndex = idealField.val();

		if(idealIndex !== '' && plotIndex <= idealIndex)
			idealField.val(plotIndex == idealIndex ? '' : idealIndex - 1);

		plotField.remove();
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

	simulate: function(sprint, plots, events, timeAxis) {
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
			if(max === undefined && event.date > sprint.start) {
				max = 0;
				// only issues in the sprint or with a parent in the sprint are relevant
				var relevant = GADGET.relevant(issues, sprint.id);
				plots.forEach(function(plot) {
					plot.initial = plot.y = plot.aggregate(relevant);
					if(plot.y > max) max = plot.y;
					plot.points = [[0, plot.y]];
				});
			}

			// update the issue records with information from this event
			if(issues[event.issue] === undefined)
				issues[event.issue] = AJS.$.extend({}, defaults);
			issues[event.issue][event.field] = event.value;

			// if within the sprint
			if(event.date > sprint.start) {
				var relevant = GADGET.relevant(issues, sprint.id);

				var x = event.time[timeAxis];

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

		var x = GADGET.calculateDate(sprint.complete, sprint.periods.slice(0))[timeAxis];
		plots.forEach(function(plot) {
			plot.points.push([x, plot.y])
		});

		return max;
	},

	calculateDate: function(date, periods) {
		while(periods.length > 1 && date > periods[0].end) periods.shift();
		var period = periods[0];

		date = Math.min(Math.max(date,period.start),period.end);

		var diff = date - period.start;

		return {
			constantTime: period.constantTime + diff,
			constantWork: period.constantWork + period.rate * diff,
			nonZeroWork: period.nonZeroWork + (period.rate ? diff : 0)
		};
	},

	calculateIdeal: function(initial, timeAxis, periods, periodTotals) {
		return idealLine = {
			line: {
				fill: 'none',
				stroke: 'grey',
				'stroke-opacity': 0.5,
				strokeWidth: 3
			},

			points: periods.map(function(period) {
				return [period[timeAxis], (1 - period.constantWork / periodTotals.constantWork) * initial];
			}).concat([[ periodTotals[timeAxis], 0 ]])
		};
	},

	parseExpression: function(expr) {
		expr = math.parse(expr);

		return {
			variables: expr
				.filter(function(node) { return node.type === 'SymbolNode'; })
				.map(function(node) { return node.name; }),
			expr: expr.compile(math)
		};
	},

	render: function(svg, args) {
		var gadgetDiv = gadget.getGadget();
		var ratioPref = gadget.getPref('aspectRatio').split(':')
        var ratio = ratioPref[0] / ratioPref[1];
        var width = gadgetDiv.width();
        var height = width / ratio;

		var temp = args.sprintData.complete - args.sprintData.start;
		args.sprintData.periods = [{
			start: args.sprintData.start,
			end: args.sprintData.start + temp/2,
			rate: 0.5,
		}, {
			start: args.sprintData.start + temp/2,
			end: args.sprintData.complete,
			rate: 1,
		}, {
			start: args.sprintData.complete,
			end: args.sprintData.end,
			rate: 0,
		}];

		svg.configure({width: width, height: height});

		var timeAxis = gadget.getPref("timeAxis");

		var plots = GADGET.getPlots();

		plots.forEach(function(plot) {
			plot.line = {
				fill: 'none',
				stroke: plot.colour,
				'stroke-opacity': 0.5,
				strokeWidth: 2
			};

			var parsed = GADGET.parseExpression(plot.expr);
			plot.expr = parsed.expr;
			plot.variables = parsed.variables;

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
					// TODO: Combine the sprintData and issueData calls on the backend to allow this filtration on the server
					if(event.date <= args.sprintData.complete) events.push(event);
				})
			}
		}
		events.sort(function(a,b) {return a.date - b.date;});

		var periodTotals = args.sprintData.periods.reduce(function(totals, period) {
			period.duration = period.end - period.start;

			period.constantTime = period.start - args.sprintData.start;
			period.constantWork = totals.constantWork;
			period.nonZeroWork = totals.nonZeroWork;

			totals.constantWork += period.rate * period.duration;
			totals.nonZeroWork += period.rate ? period.duration : 0;

			return totals;
		}, { constantWork: 0, nonZeroWork: 0, constantTime: args.sprintData.end - args.sprintData.start });

		// calculateDate is destructive on the 'periods' parameter, so copy it.
		var periods = args.sprintData.periods.slice(0);
		events.forEach(function(event) { event.time = GADGET.calculateDate(event.date, periods, periodTotals); });

		var max = GADGET.simulate(args.sprintData, plots, events, timeAxis);

		var idealPlot = gadget.getPref('idealPlot');
		if(idealPlot !== '')
			plots.unshift(GADGET.calculateIdeal(plots[idealPlot].initial, timeAxis, args.sprintData.periods, periodTotals));

		var left = 20;
		var top = 20;
		var right = width - 20;
		var bottom = height - 20;

		var xScale = (right - left) / periodTotals[timeAxis];
		var yScale = (top - bottom) / max;

		plots.forEach(function(plot) {
			plot.points.forEach(function(point) {
				point[0] = point[0] * xScale + left;
				point[1] = point[1] * yScale + bottom;
			});

			svg.polyline(plot.points, plot.line);
		});

		svg.polyline([[left, top], [left, bottom], [right, bottom]],{fill:'none', stroke:'grey', strokeWidth:1 });

		// Maximum number of intervals, assuming a 50-pixel gap
		var maxIntervals = (width - 40) / 50;
		// Minimum gap between intervals given the amount of time rendered on the graph
		var minInterval = periodTotals[timeAxis] / maxIntervals / 60000;

		// Round the time interval up to something sensible
		var hour=60, day=24*hour;
		var intervals = [1, 5, 10, 15, 20, 30, hour, 2*hour, 3*hour, 4*hour, 6*hour, 12*hour, day, 2*day, 3*day, 7*day];
		var interval = intervals.filter(function(i) {return i > minInterval;})[0];

		var startMinutes = args.sprintData.start - new Date(args.sprintData.start).setHours(0,0,0,0);
		var format = interval < hour ? 'h:mma' : (interval < day ? 'ha ddd' : 'ddd Do');
		var modulo = (interval < day ? interval : day) * 60000;
		// ensure we start bang on an interval
		var offset = modulo - (startMinutes % modulo);
		// Plot a subtle vertical line at each interval, up to 3px wide on co-incident intervals to indicate gaps.
		// Treat interval as real-time.
		periods = args.sprintData.periods.slice(0);
		var line, text;
		for(var time = args.sprintData.start + offset; time <= args.sprintData.end; time += interval * 60000) {
			var sX = (GADGET.calculateDate(time, periods, periodTotals)[timeAxis] * xScale + left).toFixed(3);
			if(!line || line.attr('x1') !== sX) {
				line = AJS.$(svg.line(sX, top, sX, bottom + 3, { stroke: 'grey', 'stroke-width': '0' }));
				if(!text || Number.parseFloat(text.attr('x')) < Number.parseFloat(sX) - 50)
					text = AJS.$(svg.text(sX,bottom,'',{'text-anchor':'middle',dy:'1.1em'}))
			}
			line.attr('stroke-width',Math.min(3,Number.parseInt(line.attr('stroke-width')) + 1));
			if(text.attr('x') === sX)
				text.text(moment(time).format(format));
		}
	}
};