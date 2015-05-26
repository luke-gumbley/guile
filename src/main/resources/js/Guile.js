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
                    fields: ['timeestimate','Sprint','Parent Issue']
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
            },
            AJS.gadget.fields.nowConfigured()]
        };
    },

    calculate: function(issues, sprint) {
        return Object.keys(issues)
            .map(function(key) { return issues[key]; })
            .filter(function(issue) {
                // only issues in the sprint
                return (issue['Parent Issue'] === undefined && issue['Sprint'] == sprint)
                    // or subtasks with a parent in the sprint
                    || (issues[issue['Parent Issue']] !== undefined && issues[issue['Parent Issue']]['Sprint'] == sprint);
            })
            .reduce(function(total, issue) { return total+=parseInt(issue['timeestimate'] || '0'); }, 0)
    },

    render: function(svg, args) {
        var start = new Date(args.sprintData.sprint.startDate).getTime();
        var end = new Date(args.sprintData.sprint.endDate).getTime();
        var sprintId = args.sprintData.sprint.id;

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

        var max = 0;
        var total = 0;
        var issues = {};
        var points = [];

        events.forEach(function(event) {
            // calculate and post the opening total
            if(event.date > start && points.length === 0) {
                max = total = GADGET.calculate(issues, sprintId);
                points.push([0, total]);
            }

            // update the issue records
            if(issues[event.issue] === undefined)
                issues[event.issue] = {};
            issues[event.issue][event.field] = event.value;

            // if within the sprint
            if(event.date > start) {
                postTotal = GADGET.calculate(issues, sprintId);
                // and a transition occurred
                if(postTotal !== total) {
                    var x = event.date - start;
                    // plot that transition.
                    points.push([x, total], [x, postTotal]);
                    total = postTotal;
                    if(total > max) max = total;
                }
            }
        });

        var left = 20;
        var top = 20;
        var right = svg.width() - 40;
        var bottom = svg.height() - 40;

        var xScale = (right - left) / (end - start);
        var yScale = (top - bottom) / max;

        points.forEach(function(point) {
            point[0] = point[0] * xScale + left;
            point[1] = point[1] * yScale + bottom;
        });

        svg.polyline(points, {fill: 'none', stroke: 'black', strokeWidth: 2});
    }
};