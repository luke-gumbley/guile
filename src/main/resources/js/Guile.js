GADGET = {
    ajax: function(settings) {
        var deferred = AJS.$.Deferred();
        settings.success = function() {deferred.resolveWith(this,arguments);};
        settings.error = function() {deferred.rejectWith(this,arguments);};
        return deferred.promise(AJS.$.ajax(settings));
    },

    template: function (args) {
        var gadget=this;
        gadget.getView().svg({onLoad:GADGET.render,settings:{width:'100%',height:'100%'}});
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
            },
            AJS.gadget.fields.nowConfigured()]
        };
    },

    render: function(svg) {
        svg.polyline([[20,20],[40,25],[60,40],[80,120],[120,140],[200,180]], {fill: 'none', stroke: 'black', strokeWidth: 3});
    }
};