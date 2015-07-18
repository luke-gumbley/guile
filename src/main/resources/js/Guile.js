var guile = (function($) {
	var guile = {};

	var Classy = function(definition) {
		$.extend(definition.init.prototype, definition);
		return definition.init;
	};

	guile.Sprint = Classy({
		init: function Sprint(sprint, changes) {
			this.id = sprint.id;
			this.start = sprint.start;
			this.end = sprint.end;
			this.complete = sprint.complete;
			this.periods = new guile.Periods(sprint.start, sprint.end, sprint.periods);

			// TODO: pre-flatten on the server to simplify.
			this.events = guile.flatten(changes, ['field','issue'])
				// TODO: Combine the sprintData and issueData calls on the backend to allow this filtration on the server
				.filter(function(event) { return event.date <= sprint.complete; })
				.sort(function(a,b) {return a.date - b.date;})
				.map(function(event) {
					// TODO: Parse on the server and return numerics directly. Sigh, greenhopper.
					// parse as a float if possible, math.js can work with strings though so don't rule out crazy stuff.
					var value = event.value === "" ? 0 : parseFloat(event.value);
					return $.extend(event, {
						value: isNaN(value) ? event.value : value,
						time: this.periods.calculate(event.date)
					});
				}, this);
		},

		relevant: function(issues) {
			return Object.keys(issues)
				.map(function(key) { return issues[key]; })
				.filter(function(issue) {
					// only issues in the sprint
					return (issue['Parent Issue'] === undefined && issue['Sprint'] == this.id)
						// or subtasks with a parent in the sprint
						|| (issues[issue['Parent Issue']] !== undefined && issues[issue['Parent Issue']]['Sprint'] == this.id);
				}, this)
		},

		simulate: function(defaults, inspect) {
			// start with no knowledge of any issues...
			var issues = {};
			var started = false;

			// and build issue knowledge with each event
			this.events.forEach(function(event) {
				// calculate and post the opening total for each plot, once all pre-sprint events have been processed.
				if(!started && event.date > this.start) {
					started = true;
					// only issues in the sprint or with a parent in the sprint are relevant
					inspect(this.relevant(issues));
				}

				// update the issue records with information from this event
				if(issues[event.issue] === undefined)
					issues[event.issue] = $.extend({}, defaults);
				issues[event.issue][event.field] = event.value;

				// if within the sprint
				if(event.date > this.start) {
					inspect(this.relevant(issues), event.time);
				}
			}, this);

			// ensure
			inspect(this.relevant(issues), this.periods.calculate(this.complete));
		},
	});

	guile.Periods = Classy({
		init: function Periods(start, end, periods) {
			this.start = start;
			this.end = end;

			this.periods = periods.map(function(period) {
				return {
					start: period.start,
					end: period.end,
					rate: period.rate,
					duration: period.end - period.start
				};
			}).sort(function(a,b) {a.start - b.start});

			this.totals = this.periods.reduce(function(totals, period) {
				period.constantTime = period.start - start;
				period.constantWork = totals.constantWork;
				period.nonZeroWork = totals.nonZeroWork;
				totals.constantWork += period.rate * period.duration;
				totals.nonZeroWork += period.rate ? period.duration : 0;
				return totals;
			}, { constantWork: 0, nonZeroWork: 0, constantTime: end - start });

			this.periods.forEach(function(period) {
				period.completion = (1 - period.constantWork / this.totals.constantWork);
			}, this)
		},

		calculate: function(date) {
			var state = this.calculateState = (this.calculateState && this.calculateState.date <= date)
				? this.calculateState
				: { offset: 0 };
			state.date = date;

			while(state.offset < (this.periods.length - 1) && date > this.periods[state.offset].end)
				state.offset++;

			var period = this.periods[state.offset];

			date = Math.min(Math.max(date, period.start), period.end);

			var diff = date - period.start;

			return {
				constantTime: period.constantTime + diff,
				constantWork: period.constantWork + period.rate * diff,
				nonZeroWork: period.nonZeroWork + (period.rate ? diff : 0)
			};
		},

		points: function(transform) {
			transform = transform || function(time,completion) { return [time[constantTime], completion * 100]; };

			return this.periods
				.map(function(period) { return [period, period.completion]; })
				.concat([[ this.totals, 0 ]])
				.map(function(point) { return transform(point[0], point[1]); });
		},
	});

	guile.Plot = Classy({
		init: function Plot(line, expression) {
			expression = expression || '';
			var parsed = math.parse(expression);

			this.expression = expression;
			this.variables = parsed
				.filter(function(node) { return node.type === 'SymbolNode'; })
				.map(function(node) { return node.name; });

			this.defaults = {};
			this.variables.forEach(function(variable) { this.defaults[variable] = 0; }, this);

			this.compiled = parsed.compile(math);
			this.points = [];

			this.line = $.extend({
				fill: 'none',
				stroke: 'grey',
				'stroke-opacity': 0.5,
				strokeWidth: 2
			},line);
		},

		aggregate: function(issues) {
			var self = this;
			return issues.reduce(function(total, issue) {
				return total += self.compiled.eval(issue);
			}, 0)
		},

		add: function(x, issues) {
			var y = this.aggregate(issues);

			// last two points in the array - will only ever differ in one dimension (cardinal plot)
			var a = this.points[this.points.length - 2];
			var b = this.points[this.points.length - 1];

			// defines the axis parallel to the last segment
			var axis = a && b && (a[0] === b[0] ? 0 : 1);

			if(b === undefined)
				// this is the first point.
				this.points.push([x, y]);
			else if(axis !== undefined && [x,y][axis] === b[axis]) {
				// in line with the last two, so move the previous point instead of adding a new one
				b[axis^1] = [x,y][axis^1];
			}
			else {
				// either no existing segment or not in line - so add at least one new point, preferably moving along X first
				if(x != b[0])
					this.points.push([x, b[1]]);

				if(y != b[1])
					this.points.push([x, y]);
			}
		},

		parse: function(expr) {
			expr = math.parse(expr);

			return {
				variables: expr
					.filter(function(node) { return node.type === 'SymbolNode'; })
					.map(function(node) { return node.name; }),
				expr: expr.compile(math)
			};
		},

		initial: function() {
			return this.points.length ? this.points[0][1] : 0;
		},

		max: function() {
			return this.points.reduce(function(max, point) { return max > point[1] ? max : point[1]; }, 0);
		},
	});

	// utility function for recursively flattening nested dictionaries into an array
	guile.flatten = function(collection, properties) {
		var property = properties[0];

		return $.map(Object.keys(collection), function(key) {
			var value = collection[key];

			var elements = properties.length === 1
				? ($.isArray(value) ? value : [value])
				: guile.flatten(value, properties.slice(1));

			elements.forEach(function(e) { e[property] = key; });

			return elements;
		});
	};

	return guile;
}(AJS.$));

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
				return new guile.Plot({ stroke: plot.colour }, plot.expr).variables;
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

	render: function(svg, args) {
		var gadgetDiv = gadget.getGadget();
		var ratioPref = gadget.getPref('aspectRatio').split(':')
        var ratio = ratioPref[0] / ratioPref[1];
        var width = gadgetDiv.width();
        var height = width / ratio;

		svg.configure({width: width, height: height});

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

		var sprint = new guile.Sprint(args.sprintData, args.issueData.changes);

		// property of a plot?
		var timeAxis = gadget.getPref("timeAxis");

		var plots = GADGET.getPlots().map(function(plot) { return new guile.Plot({ stroke: plot.colour }, plot.expr); });

		// ensure a default is set for every variable required for every plot
		var defaults = plots.reduce(function(defaults, plot) { return AJS.$.extend(defaults, plot.defaults); }, {});

		sprint.simulate(defaults, function(issues, time) {
			var x = time === undefined ? 0 : time[timeAxis];
			plots.forEach(function(plot) { plot.add(x, issues); });
		});

		var idealPlot = gadget.getPref('idealPlot');
		if(idealPlot !== '') {
			var initial = plots[idealPlot].initial();

			var ideal = new guile.Plot({ strokeWidth: 3 });
			ideal.points = sprint.periods.points(function(time, completion) { return [time[timeAxis], completion*initial]; });

			plots.unshift(ideal);
		}

		var left = 20;
		var top = 20;
		var right = width - 20;
		var bottom = height - 20;

		var xScale = (right - left) / sprint.periods.totals[timeAxis];
		var yScale = (top - bottom) / Math.max.apply(Math, plots.map(function(plot) { return plot.max(); }));

		plots.forEach(function(plot) {
			plot.points.forEach(function(point) {
				point[0] = point[0] * xScale + left;
				point[1] = point[1] * yScale + bottom;
			});

			svg.polyline(plot.points, plot.line);
		});

		svg.polyline([[left, top], [left, bottom], [right, bottom]],{fill:'none', stroke:'grey', strokeWidth:1 });

		// timeAxis, args.sprintData.start, args.sprintData.end
		// periods,
		// width, xScale, left, top, bottom

		// Maximum number of intervals, assuming a 50-pixel gap
		var maxIntervals = (width - 40) / 50;
		// Minimum gap between intervals given the amount of time rendered on the graph
		var minInterval = sprint.periods.totals[timeAxis] / maxIntervals / 60000;

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
		var line, text;
		for(var time = args.sprintData.start + offset; time <= args.sprintData.end; time += interval * 60000) {
			var sX = (sprint.periods.calculate(time)[timeAxis] * xScale + left).toFixed(3);
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