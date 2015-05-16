GADGET = {
    template: function (args) {
        var gadget=this;
        gadget.getView().svg({onLoad:GADGET.render,settings:{width:'100%',height:'100%'}});
    },

    render: function(svg) {
        svg.polyline([[20,20],[40,25],[60,40],[80,120],[120,140],[200,180]], {fill: 'none', stroke: 'black', strokeWidth: 3});
    }
};