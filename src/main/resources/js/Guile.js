GADGET = {
    template: function (args) {
        var gadget=this;
        gadget.getView().svg({onLoad:GADGET.render,settings:{width:'100%',height:'100%'}});
    },

    descriptor: function(args) {
        return {
            //action: "validation url",
            theme: "long-label", //top-label
            fields:[{
                //id: "cumulative-field",
                //class: "cumulative-select-list",
                userpref: "board",
                label: "Board",
                //description: "Select the board containing the sprint you wish to view.",
                type: "select",
                selected: gadget.getPref("board"),
                options: args.rapidview.views.map(function(board) {return {label:board.name,value:board.id};})
            }, AJS.gadget.fields.nowConfigured()]
        };
    },

    render: function(svg) {
        svg.polyline([[20,20],[40,25],[60,40],[80,120],[120,140],[200,180]], {fill: 'none', stroke: 'black', strokeWidth: 3});
    }
};