$(document).ready(function(){

    var Eventer = function() {

        if( !(this instanceof Eventer) ) {
            return new Eventer();
        }

        cache = {};

        this.publish = function(topic, args){
            if(typeof cache[topic] === 'object') {    
                cache[topic].forEach(function(property){
                    property.apply(this, args || []);
                });
            }
        };

        this.subscribe = function(topic, callback){
            if(!cache[topic]){
                cache[topic] = [];
            }
            cache[topic].push(callback);
            return [topic, callback]; 
        };

        this.unsubscribe = function(topic, fn){
            if( cache[topic] ) {
                cache[topic].forEach(function(element, idx){
                    if(element == fn){
                        cache[topic].splice(idx, 1);
                    }
                });
            }
        };

        this.queue = function() {
            return cache;
        };

        // alias
        this.on      = this.subscribe;
        this.off     = this.unsubscribe;
        this.trigger = this.publish;

      return this;
    };

var eventer = new Eventer;


/* -----------------------------------
  initialize
----------------------------------- */
var width = 900, height = 400, aspect = width / height;

var margin = {top: 0, right: 0, bottom: 0, left: 0},
    cWidth = width - margin.left - margin.right,
    cHeight = height - margin.top - margin.bottom;

var container = d3.select("#chartArea").append("svg")
    .attr("width", width)
    .attr("height", width * aspect)
    .attr("viewBox", "0 0 "+ width +" " + height +"")
    .attr("preserveAspectRatio", "xMidYMid")
    .attr("id", "chart")
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


/* -----------------------------------
  viewport
----------------------------------- */

var svgContainer =   container.append("svgContainer:g").attr("id", "treemap")
                                  .attr("transform", "translate(0,10)");

var breadcrumb = container.append("g")
    .attr("class", "breadcrumb");

breadcrumb.append("rect")
    .attr("y", -margin.top)
    .attr("width", cWidth)
    .attr("height", "16px")
    // .attr("class", "backNav")
    .style("fill", "#EEE")
    .style("stroke", "none");

breadcrumb.append("text")
    .attr("x", 6)
    .attr("y", 6 - margin.top)
    .attr("dy", ".75em");



/* -----------------------------------
  main
----------------------------------- */
var Graph = function() {

    /* init */
    var formatNumber = d3.format(".2");
    var transitioning;
    var root;


    /* ----------
    scale
    ---------- */
    var xScale = d3.scale.linear()
        .domain([0, width])
        .range([0, width]);

    var yScale = d3.scale.linear()
        .domain([0, height])
        .range([0, height]);

    var color = d3.scale.category20c();


    /* ----------
    treemap
    ---------- */
    var treemap = d3.layout.treemap()
        .children(function(d, depth) { return depth ? null : d._children; })
        .sort(function(a, b) { return a.value - b.value; })
        .ratio(height / width * 0.5 * (1 + Math.sqrt(5)))
        .round(false);


    /* event */
    var self = this;
    this.e = new Eventer;

    this.init = function() {
        this.e.subscribe( 'load', this.getData );
        this.e.subscribe( 'load:init', this.drawDots );

        this.e.publish( 'load' );
    };

    this.getData = function() {

        d3.json('assets/data.json', function(error, _data){
            root = _data;
            self.e.publish('load:init');
        });

    };

    this.drawDots = function() {

        initialize(root);
        accumulate(root);
        layout(root);
        display(root);

        function initialize(root) {
            root.x = root.y = 0;
            root.dx = cWidth;
            root.dy = cHeight;
            root.depth = 0;
        }


        // Aggregate the values for internal nodes. This is normally done by the
        // treemap layout, but not here because of our custom implementation.
        // We also take a snapshot of the original children (_children) to avoid
        // the children being overwritten when when layout is computed.
        function accumulate(d) {
          return (d._children = d.children)
              ? d.value = d.children.reduce(function(p, v) { return p + accumulate(v); }, 0)
              : d.value;
        }


        // Compute the treemap layout recursively such that each group of siblings
        // uses the same size (1×1) rather than the dimensions of the parent cell.
        // This optimizes the layout for the current zoom state. Note that a wrapper
        // object is created for the parent node for each group of siblings so that
        // the parent’s dimensions are not discarded as we recurse. Since each group
        // of sibling was laid out in 1×1, we must rescale to fit using absolute
        // coordinates. This lets us use a viewport to zoom.
        function layout(d) {
          if (d._children) {
            treemap.nodes({_children: d._children});
            d._children.forEach(function(c) {
              c.x = d.x + c.x * d.dx;
              c.y = d.y + c.y * d.dy;
              c.dx *= d.dx;
              c.dy *= d.dy;
              c.parent = d;
              layout(c);
            });
          }
        }


        function display(d) {

          /* breadcrumb path */

          breadcrumb
              .datum(d.parent)
              .on("click", transition)
            .select("text")
              .style("fill", "#666")
              .attr("font-size", "8px")
              .text(name(d));


        // クリックズームの設定
        d3.select("#treemap").on("click", function(){
          d3.select("#treemap").datum(d.parent).on("click", transition).select("text").text(name(d));
        });



          /* trees */
          var g1 = svgContainer.insert("g", ".breadcrumb")
              .datum(d)
              .attr("class", "depth");

          var g = g1.selectAll("g")
              .data(d._children)
            .enter().append("g");





          /*
          押せる子供たちを表示
          */
          g.filter(function(d) { return d._children; })
              .classed("children", true)
              .on("click", transition);

          g.selectAll(".child")
              .data(function(d) { return d._children || [d]; })
            .enter().append("rect")
              .attr("class", "child")
              .call(rect);

          /*
          押せる、押せないにかかわらず表示
          */
          g.append("rect")
              .attr("class", "parent")
              .call(rect)
            .append("title")
              .text(function(d) {
                //console.log(d);
                return formatNumber(d.value);
              });

          g.append("text")
              .attr("dy", ".75em")
              .attr("font-size", "10px")
              .attr("fill", "#333")
              .style("font-weight", "bold")
              .text(function(d) { return d.name; })
              .call(text);

          g.append("text")
              .attr("dy", "2.75em")
              .attr("font-size", "8px")
              .attr("fill", "#666")
              .style("opacity", function(d){
                // console.log( d3.select(this.parentNode).parent );
                return 1.0;
              })
              .text(function(d) {
                 if (d.value>1000000000) {
                      var _nv = d.value / 1000000000;
                      var _ns = _nv.toFixed(2) + "兆円";
                  } else　if (d.value>100000) {
                      var _nv = d.value / 100000;
                      var _ns = _nv.toFixed(2) + "億円";
                  } else {
                      var _nv = d.value / 10000;
                      var _ns = _nv.toFixed(2) + "千万円";
                  }
                  return _ns;
              })
              .call(text);





          function transition(d) {

                console.log("transition");

                if (transitioning || !d) return;
                transitioning = true;

                var g2 = display(d),
                    t1 = g1.transition().duration(750),
                    t2 = g2.transition().duration(750);

                // Update the domain only after entering new elements.
                xScale.domain([d.x, d.x + d.dx]);
                yScale.domain([d.y, d.y + d.dy]);

                // Enable anti-aliasing during the transition.
                svgContainer.style("shape-rendering", null);

                // Draw child nodes on top of parent nodes.
                svgContainer.selectAll(".depth").sort(function(a, b) { return a.depth - b.depth; });

                // Fade-in entering text.
                g2.selectAll("text").style("fill-opacity", 0);

                // Transition to the new view.
                t1.selectAll("text").call(text).style("fill-opacity", 0);
                t2.selectAll("text").call(text).style("fill-opacity", 1);
                t1.selectAll("rect").call(rect);
                t2.selectAll("rect").call(rect);

                // Remove the old node when the transition is finished.
                t1.remove().each("end", function() {
                  svgContainer.style("shape-rendering", "crispEdges");
                  transitioning = false;
                });
          }

          return g;
        }


    /* ----------
    utility functions
    ---------- */
    function text(text) {
      text.attr("x", function(d) { return xScale(d.x) + 12; })
          .attr("y", function(d) { return yScale(d.y) + 16; });
    }

    function rect(rect) {
      rect.attr("x", function(d) { return xScale(d.x); })
          .attr("y", function(d) { return yScale(d.y); })
          .attr("width", function(d) { return xScale(d.x + d.dx) - xScale(d.x); })
          .attr("height", function(d) { return yScale(d.y + d.dy) - yScale(d.y); });
    }

    function name(d) {
      return d.parent
          ? name(d.parent) + ">" + d.name
          : d.name;
    }



    };





	this.init.apply( this, arguments );
};


/* -----------------------------------
  responsive with window size
----------------------------------- */
var chart = $("#chart"),
    container = chart.parent();

$(window).on("resize", function() {

    var targetWidth = container.width();
    chart.attr("width", targetWidth);
    chart.attr("height", Math.round(targetWidth / aspect));

}).trigger("resize");


new Graph;

});