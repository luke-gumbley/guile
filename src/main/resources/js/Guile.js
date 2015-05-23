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
                    fields: ['timeestimate','timespent']
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

    render: function(svg, args) {
        var start = new Date(args.sprintData.sprint.startDate).getTime();
        var end = new Date(args.sprintData.sprint.endDate).getTime();

        var estimates = args.issueData.changes.timeestimate;
        var events = [];
        for(issue in estimates) {
            var current = 0;
            estimates[issue].forEach(function(event) {
                event.delta = event.value - current;
                event.issue = issue;
                current = event.value;
            });
            events = events.concat(estimates[issue]);
        }
        events.sort(function(a,b) {return a.date - b.date;});

        var left = 20;
        var top = 20;
        var right = svg.width() - 40;
        var bottom = svg.height() - 40;

        var max = 0;
        var total = 0;

        events.forEach(function(event) {
            total += event.delta;
            if(total > max) max = total;
        });

        var xScale = (right - left) / (end - start);
        var yScale = (top - bottom) / max;

        var points = [];

        var y = 0;
        events.forEach(function(event) {
            if(event.date > start) {
                if(points.length === 0)
                    points = points.concat([[0, y]]);
                var x = event.date - start;
                points = points.concat([[x, y], [x, y + event.delta]]);
            }
            y += event.delta;
        })

        points.forEach(function(point) {
            point[0] = point[0] * xScale + left;
            point[1] = point[1] * yScale + bottom;
        });

        svg.polyline(points, {fill: 'none', stroke: 'black', strokeWidth: 3});
    }
};