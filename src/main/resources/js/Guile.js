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
				.map(function(event) { return new guile.Event(event, this.periods); }, this);
		},

		relevant: function(issues) {
			return Object.keys(issues)
				.map(function(key) { return issues[key]; })
				.filter(function(issue) {
					// only issues in the sprint
					return (issue['parent'] === undefined && issue['sprint'] == this.id)
						// or subtasks with a parent in the sprint
						|| (issues[issue['parent']] !== undefined && issues[issue['parent']]['sprint'] == this.id);
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
		init: function Plot(line, timescale, expression) {
			expression = expression || '';

			this.expression = expression;
			$.extend(this,guile.parse(expression));

			this.timescale = timescale;

			this.defaults = {};
			this.fields.forEach(function(field) {
				this.defaults[field.alias] = field.unit ? math.unit(0,field.unit) : 0;
			}, this);
			this.defaultValue = this.compiled.eval(this.defaults);

			this.points = [];

			this.line = $.extend({
				fill: 'none',
				stroke: 'grey',
				'stroke-opacity': 0.5,
				'vector-effect': 'non-scaling-stroke',
				strokeWidth: 2
			},line);
		},

		aggregate: function(issues) {
			return issues.length === 0
				? this.defaultValue
				: math.sum(issues.map(function(issue) { return this.compiled.eval(issue); }, this));
		},

		scale: function(time) {
			return time === undefined ? 0 : time[this.timescale];
		},

		add: function(time, value) {
			this.points.push([this.scale(time), value]);
		},

		plot: function(time, issues) {
			var x = this.scale(time);
			var y = this.aggregate(issues);

			// last two points in the array - will only ever differ in one dimension (cardinal plot)
			var a = this.points[this.points.length - 2];
			var b = this.points[this.points.length - 1];

			// defines the axis parallel to the last segment
			var axis = a && b && (a[0] === b[0] ? 0 : 1);

			if(b === undefined)
				// this is the first point.
				this.points.push([x, y]);
			else if(axis !== undefined && math.equal([x,y][axis],b[axis])) {
				// in line with the last two, so move the previous point instead of adding a new one
				b[axis^1] = [x,y][axis^1];
			}
			else {
				// either no existing segment or not in line - so add at least one new point, preferably moving along X first
				if(x != b[0])
					this.points.push([x, b[1]]);

				if(!math.equal(y, b[1]))
					this.points.push([x, y]);
			}
		},

		initial: function() {
			return this.points.length ? this.points[0][1] : this.defaultValue;
		},

		min: function() {
			return math.min(this.points.map(function(point) {return point[1];}));
		},

		max: function() {
			return math.max(this.points.map(function(point) {return point[1];}));
		},

		coords: function(unit) {
			return !unit || math.isNumeric(this.defaultValue)
				? this.points
				: this.points.map(function(point) { return [point[0],point[1].toNumber(unit)]; });
		},

		ideal: function(periods) {
			var initial = this.initial();
			var ideal = new guile.Plot({ strokeWidth: 3 }, this.timescale, this.expression);

			periods.points(function(time, completion) { ideal.add(time, math.multiply(completion,initial)); });

			return ideal;
		},
	});

	guile.Range = Classy({
		init: function Range(start, end) {
			this.start = start;
			this.end = end;
			this.range = math.subtract(end, start)
		},

		transformed: function(transform) {
			return new guile.Range(transform(this.start), transform(this.end));
		}
	});

	guile.Axis = Classy({
		init: function Axis(options) {
			// takes a real value and returns a value in axis-space
			this.transform = options.transform || function(v) { return v; };

			this.screen = new guile.Range(options.screen.start, options.screen.end);
			this.value = new guile.Range(options.value.start, options.value.end);
			this.transformed = this.value.transformed(this.transform);

			this.scale = math.divide(this.screen.range, this.transformed.range);

			// calculate parameters for the grid
			var interval = this.calculateInterval(50, options.intervals);
			this.calculateGrid(interval, options.zero, options.snap);

			this.unit = interval.isUnit && interval.formatUnits();

			this.numericScale = this.unit ? this.screen.range / this.transformed.range.toNumber(this.unit) : this.scale;
		},

		calculateInterval: function(gap, intervals) {
			// try to get an axis tick every x pixels
			gap = math.divide(gap, guile.math.abs(this.scale));

			// find the smallest size larger than the gap
			return intervals
				? intervals.filter(function(interval) { return math.larger(interval, gap); })[0]
				: guile.Axis.autoInterval(gap);
		},

		calculateGrid: function(interval, reset, snap) {
			// snap to the nearest interval or the maximum provided
			snap = snap ? math.min(interval, snap) : interval;

			// zero the start value to ensure the interval lands correctly
			var zero = reset ? reset(this.value.start) : this.value.start;

			// find the offset to ensure the first tick lands on an interval
			var offset = math.subtract(snap, guile.math.mod(zero, snap));

			this.grid = { interval: interval, offset: offset };
		},

		renderGrid: function(renderFunc) {
			for(var value = this.value.start + this.grid.offset; value <= this.value.end; value += this.grid.interval) {
				var transformed = math.multiply(this.transform(value), this.scale);
				var screen = (transformed.isUnit ? transformed.value : transformed) + this.screen.start;
				renderFunc(value, screen, transformed);
			}
		}
	});

	// YAGNI... but nyah nyah it's my project
	guile.Axis.units = {
		'TIME': ['h', 'minute', 's']
	};

	guile.Axis.getUnits = function(unit) {
		if(!unit.isUnit) return undefined;

		for(base in guile.Axis.units) {
			if(unit.equalBase(math.type.Unit.BASE_UNITS[base]))
				return guile.Axis.units[base];
		}

		return [unit.formatUnits()];
	}

	guile.Axis.autoInterval = function(gap) {
		if(gap.isUnit) {
			var interval = guile.Axis.getUnits(gap)
				.map(function(unit) {
					return { unit: unit, num: guile.Axis.autoInterval(gap.toNumber(unit))};
				})
				.sort(function(a, b) {
					a = math.log10(a.num);
					b = math.log10(b.num);
					return (a >= 0) != (b >= 0)
						// prefer intervals greater than 1
						? math.compare(b, a)
						// failing that distinction, prefer the interval closer to zero
						: math.compare(math.abs(a), math.abs(b));
				})
				[0];
			return math.unit(interval.num, interval.unit);
		}

		if(gap == 0) return 0;
		var exp = math.ceil(math.log10(math.abs(gap)));
		// round to 2 s.f. modulo 5
		var factor = math.pow(10, exp - 2) * 5;
		return math.round(gap / factor) * factor;
	};

	guile.Axis.findUnit = function(interval) {
		if(!interval.isUnit) return undefined;

		return guile.Axis.getUnits(interval)
			.filter(function(u) { return math.smallerEq(math.unit(1,u), interval); })
			.concat(quantity.formatUnits())
			[0];
	};

	guile.Axis.dateIntervals = ['1 minute', '5 minutes', '10 minutes', '15 minutes', '20 minutes', '30 minutes',
		'1h', '2h', '3h', '4h', '6h', '12h',
		'1 day', '2 days', '3 days', '7 days'].map(function(i) { return math.unit(i).toNumber('ms'); });

	guile.Event = Classy({
		init: function Event(event, periods) {
			$.extend(this, event);

			var field = guile.field(event.field);
			this.field = field.alias

			// TODO: Parse on the server and return numerics directly. Sigh, greenhopper.
			// parse as a float if possible, math.js can work with strings though so don't rule out crazy stuff.
			var value = event.value === "" ? 0 : parseFloat(event.value);
			this.value = isNaN(value)
				? event.value
				: field.unit
					? math.unit(value, field.unit)
					: value;
			this.time = periods.calculate(event.date);
		},
	});

	// JIRA field definitions (exposed via guile.field)
	var fields = [{
		name: 'timeestimate',
		alias: 'remaining',
		unit: 'ms'
	}, {
		name: 'timespent',
		alias: 'spent',
		unit: 'ms'
	}, {
		name: 'timeoriginalestimate',
		alias: 'original',
		unit: 'ms'
	}, {
		name: 'Parent Issue',
		alias: 'parent',
	}, {
		name: 'Sprint',
		alias: 'sprint',
	}];

	guile.field = function(name) {
		var field;
		return fields.every(function(f) { field = f; return f.name !== name && f.alias !== name; })
			? { name: name, alias: name }
			: field;
	};

	// utility function for parsing an expression and returning the contained fields
	guile.parse = function(expr) {
		expr = math.parse(expr);

		return {
			fields: expr
				.filter(function(node) { return node.type === 'SymbolNode'; })
				.map(function(node) { return guile.field(node.name); }),
			compiled: expr.compile()
		};
	};

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

	// utility function to test if two numbers have equal bases
	guile.equalBase = function(a, b) {
		return math.isNumeric(a)
			? math.isNumeric(b)
			: !math.isNumeric(b) && a.equalBase(b);
	};

	// utility math functions to cope with existing shortcomings of math.js
	guile.math = {
		abs: function(x) {
			if(x.isUnit) {
				var y = x.clone();
				y.value = Math.abs(y.value);
				return y;
			}
			return math.abs(x);
		},

		mod: function(x, y) {
			var q = math.divide(x, y);
			q = (q.isUnit ? q.value : q);
			return math.multiply(math.subtract(x, y), Math.floor(q));
		},
	}

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
			var plotFields = AJS.$.map(GADGET.getPlots(this), function(plot) {
				return guile.parse(plot.expr).fields;
			});

			var issueFields = AJS.$.unique([guile.field('sprint'),guile.field('parent')]
				.concat(plotFields)
				.map(function(field) { return field.name; }));

			return {
				url: '/rest/guile/1.0/boards/' + this.getPref('board') + '/sprints/' + this.getPref('sprint') + '/changes',
				data: { fields: issueFields },
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
				userpref: 'timescale',
				label: 'Timescale',
				description: 'Choose how to render sprint periods with modified work rate (e.g. non-working days)',
				type: 'select',
				selected: gadget.getPref('timescale'),
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

		var timescale = gadget.getPref("timescale");

		var plots = GADGET.getPlots().map(function(plot) { return new guile.Plot({ stroke: plot.colour }, timescale, plot.expr); });

		// ensure a default is set for every variable required for every plot
		var defaults = plots.reduce(function(defaults, plot) { return AJS.$.extend(defaults, plot.defaults); }, {});

		sprint.simulate(defaults, function(issues, time) {
			plots.forEach(function(plot) { plot.plot(time, issues); });
		});

		var idealPlot = gadget.getPref('idealPlot');
		if(idealPlot !== '') plots.unshift(plots[idealPlot].ideal(sprint.periods));

		var left = 20, top = 20, right = width - 20, bottom = height - 20;

		var horizontal = new guile.Axis({
			screen: { start: left, end: right },
			value: { start: sprint.start, end: sprint.end },
			transform: function(time) { return sprint.periods.calculate(time)[timescale]; },
			snap: math.unit('1 day').toNumber('ms'),
			zero: function(start) { return start - new Date(start).setHours(0,0,0,0); },
			intervals: guile.Axis.dateIntervals
		});

		var axes = plots
			.reduce(function(axes, plot) {
				var add = axes.every(function(axis) {
					var match = guile.equalBase(axis.unit, plot.defaultValue);
					if(match) axis.plots.push(plot);
					return !match;
				});
				if(add) axes.push({ unit: plot.defaultValue, plots: [plot] });
				return axes;
			}, []);

		axes.forEach(function(group) {
			var extents = AJS.$.map(group.plots, function(p) { return [p.min(), p.max()]; });

			var axis = group.axis = new guile.Axis({
				screen: { start: bottom, end: top },
				value: { start: math.min(extents), end: math.max(extents) }
			});

			var plotGroup = svg.group({ transform: ''.concat(
				'translate(', horizontal.screen.start, ',', axis.screen.start, '),',
				'scale(', horizontal.numericScale, ',', axis.numericScale, ')'
			)});

			group.plots.forEach(function(plot) { svg.polyline(plotGroup, plot.coords(axis.unit), plot.line); });

			// TODO: draw vertical axes here
		});

		svg.polyline([[left, top], [left, bottom], [right, bottom]], { fill:'none', stroke:'grey', strokeWidth:1 });

		var format = math.smaller(horizontal.grid.interval, math.unit('1h').toNumber('ms'))
			? 'h:mma'
			: (math.smaller(horizontal.grid.interval, math.unit('1 day').toNumber('ms')) ? 'ha ddd' : 'ddd Do');

		var line, text;
		horizontal.renderGrid(function(time, x) {
			// Plot a subtle vertical line at each interval, up to 3px wide on co-incident intervals to indicate gaps.
			if(!line || line.x !== x) {
				line = AJS.$(svg.line(x, top, x, bottom + 3, { stroke: 'grey' }));
				line.x = x;

				if(!text || text.x < x - 50) {
					text = AJS.$(svg.text(x, bottom, '', { 'text-anchor': 'middle', dy:'1.1em' }));
					text.x = x;
				}
			}
			line.attr('stroke-width',line.count = Math.min(3, (line.count || 0) + 1));
			if(text.x === x)
				text.text(moment(time).format(format));
		});

	}
};