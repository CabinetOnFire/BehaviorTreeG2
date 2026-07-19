"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/@dagrejs/graphlib/lib/graph.js
var require_graph = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/graph.js"(exports2, module2) {
    "use strict";
    var DEFAULT_EDGE_NAME = "\0";
    var GRAPH_NODE = "\0";
    var EDGE_KEY_DELIM = "";
    var Graph = class {
      _isDirected = true;
      _isMultigraph = false;
      _isCompound = false;
      // Label for the graph itself
      _label;
      // Defaults to be set when creating a new node
      _defaultNodeLabelFn = () => void 0;
      // Defaults to be set when creating a new edge
      _defaultEdgeLabelFn = () => void 0;
      // v -> label
      _nodes = {};
      // v -> edgeObj
      _in = {};
      // u -> v -> Number
      _preds = {};
      // v -> edgeObj
      _out = {};
      // v -> w -> Number
      _sucs = {};
      // e -> edgeObj
      _edgeObjs = {};
      // e -> label
      _edgeLabels = {};
      /* Number of nodes in the graph. Should only be changed by the implementation. */
      _nodeCount = 0;
      /* Number of edges in the graph. Should only be changed by the implementation. */
      _edgeCount = 0;
      _parent;
      _children;
      constructor(opts) {
        if (opts) {
          this._isDirected = Object.hasOwn(opts, "directed") ? opts.directed : true;
          this._isMultigraph = Object.hasOwn(opts, "multigraph") ? opts.multigraph : false;
          this._isCompound = Object.hasOwn(opts, "compound") ? opts.compound : false;
        }
        if (this._isCompound) {
          this._parent = {};
          this._children = {};
          this._children[GRAPH_NODE] = {};
        }
      }
      /* === Graph functions ========= */
      /**
       * Whether graph was created with 'directed' flag set to true or not.
       */
      isDirected() {
        return this._isDirected;
      }
      /**
       * Whether graph was created with 'multigraph' flag set to true or not.
       */
      isMultigraph() {
        return this._isMultigraph;
      }
      /**
       * Whether graph was created with 'compound' flag set to true or not.
       */
      isCompound() {
        return this._isCompound;
      }
      /**
       * Sets the label of the graph.
       */
      setGraph(label) {
        this._label = label;
        return this;
      }
      /**
       * Gets the graph label.
       */
      graph() {
        return this._label;
      }
      /* === Node functions ========== */
      /**
       * Sets the default node label. If newDefault is a function, it will be
       * invoked ach time when setting a label for a node. Otherwise, this label
       * will be assigned as default label in case if no label was specified while
       * setting a node.
       * Complexity: O(1).
       */
      setDefaultNodeLabel(newDefault) {
        this._defaultNodeLabelFn = newDefault;
        if (typeof newDefault !== "function") {
          this._defaultNodeLabelFn = () => newDefault;
        }
        return this;
      }
      /**
       * Gets the number of nodes in the graph.
       * Complexity: O(1).
       */
      nodeCount() {
        return this._nodeCount;
      }
      /**
       * Gets all nodes of the graph. Note, the in case of compound graph subnodes are
       * not included in list.
       * Complexity: O(1).
       */
      nodes() {
        return Object.keys(this._nodes);
      }
      /**
       * Gets list of nodes without in-edges.
       * Complexity: O(|V|).
       */
      sources() {
        var self = this;
        return this.nodes().filter((v) => Object.keys(self._in[v]).length === 0);
      }
      /**
       * Gets list of nodes without out-edges.
       * Complexity: O(|V|).
       */
      sinks() {
        var self = this;
        return this.nodes().filter((v) => Object.keys(self._out[v]).length === 0);
      }
      /**
       * Invokes setNode method for each node in names list.
       * Complexity: O(|names|).
       */
      setNodes(vs, value) {
        var args = arguments;
        var self = this;
        vs.forEach(function(v) {
          if (args.length > 1) {
            self.setNode(v, value);
          } else {
            self.setNode(v);
          }
        });
        return this;
      }
      /**
       * Creates or updates the value for the node v in the graph. If label is supplied
       * it is set as the value for the node. If label is not supplied and the node was
       * created by this call then the default node label will be assigned.
       * Complexity: O(1).
       */
      setNode(v, value) {
        if (Object.hasOwn(this._nodes, v)) {
          if (arguments.length > 1) {
            this._nodes[v] = value;
          }
          return this;
        }
        this._nodes[v] = arguments.length > 1 ? value : this._defaultNodeLabelFn(v);
        if (this._isCompound) {
          this._parent[v] = GRAPH_NODE;
          this._children[v] = {};
          this._children[GRAPH_NODE][v] = true;
        }
        this._in[v] = {};
        this._preds[v] = {};
        this._out[v] = {};
        this._sucs[v] = {};
        ++this._nodeCount;
        return this;
      }
      /**
       * Gets the label of node with specified name.
       * Complexity: O(|V|).
       */
      node(v) {
        return this._nodes[v];
      }
      /**
       * Detects whether graph has a node with specified name or not.
       */
      hasNode(v) {
        return Object.hasOwn(this._nodes, v);
      }
      /**
       * Remove the node with the name from the graph or do nothing if the node is not in
       * the graph. If the node was removed this function also removes any incident
       * edges.
       * Complexity: O(1).
       */
      removeNode(v) {
        var self = this;
        if (Object.hasOwn(this._nodes, v)) {
          var removeEdge = (e) => self.removeEdge(self._edgeObjs[e]);
          delete this._nodes[v];
          if (this._isCompound) {
            this._removeFromParentsChildList(v);
            delete this._parent[v];
            this.children(v).forEach(function(child) {
              self.setParent(child);
            });
            delete this._children[v];
          }
          Object.keys(this._in[v]).forEach(removeEdge);
          delete this._in[v];
          delete this._preds[v];
          Object.keys(this._out[v]).forEach(removeEdge);
          delete this._out[v];
          delete this._sucs[v];
          --this._nodeCount;
        }
        return this;
      }
      /**
       * Sets node p as a parent for node v if it is defined, or removes the
       * parent for v if p is undefined. Method throws an exception in case of
       * invoking it in context of noncompound graph.
       * Average-case complexity: O(1).
       */
      setParent(v, parent) {
        if (!this._isCompound) {
          throw new Error("Cannot set parent in a non-compound graph");
        }
        if (parent === void 0) {
          parent = GRAPH_NODE;
        } else {
          parent += "";
          for (var ancestor = parent; ancestor !== void 0; ancestor = this.parent(ancestor)) {
            if (ancestor === v) {
              throw new Error("Setting " + parent + " as parent of " + v + " would create a cycle");
            }
          }
          this.setNode(parent);
        }
        this.setNode(v);
        this._removeFromParentsChildList(v);
        this._parent[v] = parent;
        this._children[parent][v] = true;
        return this;
      }
      _removeFromParentsChildList(v) {
        delete this._children[this._parent[v]][v];
      }
      /**
       * Gets parent node for node v.
       * Complexity: O(1).
       */
      parent(v) {
        if (this._isCompound) {
          var parent = this._parent[v];
          if (parent !== GRAPH_NODE) {
            return parent;
          }
        }
      }
      /**
       * Gets list of direct children of node v.
       * Complexity: O(1).
       */
      children(v = GRAPH_NODE) {
        if (this._isCompound) {
          var children = this._children[v];
          if (children) {
            return Object.keys(children);
          }
        } else if (v === GRAPH_NODE) {
          return this.nodes();
        } else if (this.hasNode(v)) {
          return [];
        }
      }
      /**
       * Return all nodes that are predecessors of the specified node or undefined if node v is not in
       * the graph. Behavior is undefined for undirected graphs - use neighbors instead.
       * Complexity: O(|V|).
       */
      predecessors(v) {
        var predsV = this._preds[v];
        if (predsV) {
          return Object.keys(predsV);
        }
      }
      /**
       * Return all nodes that are successors of the specified node or undefined if node v is not in
       * the graph. Behavior is undefined for undirected graphs - use neighbors instead.
       * Complexity: O(|V|).
       */
      successors(v) {
        var sucsV = this._sucs[v];
        if (sucsV) {
          return Object.keys(sucsV);
        }
      }
      /**
       * Return all nodes that are predecessors or successors of the specified node or undefined if
       * node v is not in the graph.
       * Complexity: O(|V|).
       */
      neighbors(v) {
        var preds = this.predecessors(v);
        if (preds) {
          const union = new Set(preds);
          for (var succ of this.successors(v)) {
            union.add(succ);
          }
          return Array.from(union.values());
        }
      }
      isLeaf(v) {
        var neighbors;
        if (this.isDirected()) {
          neighbors = this.successors(v);
        } else {
          neighbors = this.neighbors(v);
        }
        return neighbors.length === 0;
      }
      /**
       * Creates new graph with nodes filtered via filter. Edges incident to rejected node
       * are also removed. In case of compound graph, if parent is rejected by filter,
       * than all its children are rejected too.
       * Average-case complexity: O(|E|+|V|).
       */
      filterNodes(filter) {
        var copy = new this.constructor({
          directed: this._isDirected,
          multigraph: this._isMultigraph,
          compound: this._isCompound
        });
        copy.setGraph(this.graph());
        var self = this;
        Object.entries(this._nodes).forEach(function([v, value]) {
          if (filter(v)) {
            copy.setNode(v, value);
          }
        });
        Object.values(this._edgeObjs).forEach(function(e) {
          if (copy.hasNode(e.v) && copy.hasNode(e.w)) {
            copy.setEdge(e, self.edge(e));
          }
        });
        var parents = {};
        function findParent(v) {
          var parent = self.parent(v);
          if (parent === void 0 || copy.hasNode(parent)) {
            parents[v] = parent;
            return parent;
          } else if (parent in parents) {
            return parents[parent];
          } else {
            return findParent(parent);
          }
        }
        if (this._isCompound) {
          copy.nodes().forEach((v) => copy.setParent(v, findParent(v)));
        }
        return copy;
      }
      /* === Edge functions ========== */
      /**
       * Sets the default edge label or factory function. This label will be
       * assigned as default label in case if no label was specified while setting
       * an edge or this function will be invoked each time when setting an edge
       * with no label specified and returned value * will be used as a label for edge.
       * Complexity: O(1).
       */
      setDefaultEdgeLabel(newDefault) {
        this._defaultEdgeLabelFn = newDefault;
        if (typeof newDefault !== "function") {
          this._defaultEdgeLabelFn = () => newDefault;
        }
        return this;
      }
      /**
       * Gets the number of edges in the graph.
       * Complexity: O(1).
       */
      edgeCount() {
        return this._edgeCount;
      }
      /**
       * Gets edges of the graph. In case of compound graph subgraphs are not considered.
       * Complexity: O(|E|).
       */
      edges() {
        return Object.values(this._edgeObjs);
      }
      /**
       * Establish an edges path over the nodes in nodes list. If some edge is already
       * exists, it will update its label, otherwise it will create an edge between pair
       * of nodes with label provided or default label if no label provided.
       * Complexity: O(|nodes|).
       */
      setPath(vs, value) {
        var self = this;
        var args = arguments;
        vs.reduce(function(v, w) {
          if (args.length > 1) {
            self.setEdge(v, w, value);
          } else {
            self.setEdge(v, w);
          }
          return w;
        });
        return this;
      }
      /**
       * Creates or updates the label for the edge (v, w) with the optionally supplied
       * name. If label is supplied it is set as the value for the edge. If label is not
       * supplied and the edge was created by this call then the default edge label will
       * be assigned. The name parameter is only useful with multigraphs.
       */
      setEdge() {
        var v, w, name, value;
        var valueSpecified = false;
        var arg0 = arguments[0];
        if (typeof arg0 === "object" && arg0 !== null && "v" in arg0) {
          v = arg0.v;
          w = arg0.w;
          name = arg0.name;
          if (arguments.length === 2) {
            value = arguments[1];
            valueSpecified = true;
          }
        } else {
          v = arg0;
          w = arguments[1];
          name = arguments[3];
          if (arguments.length > 2) {
            value = arguments[2];
            valueSpecified = true;
          }
        }
        v = "" + v;
        w = "" + w;
        if (name !== void 0) {
          name = "" + name;
        }
        var e = edgeArgsToId(this._isDirected, v, w, name);
        if (Object.hasOwn(this._edgeLabels, e)) {
          if (valueSpecified) {
            this._edgeLabels[e] = value;
          }
          return this;
        }
        if (name !== void 0 && !this._isMultigraph) {
          throw new Error("Cannot set a named edge when isMultigraph = false");
        }
        this.setNode(v);
        this.setNode(w);
        this._edgeLabels[e] = valueSpecified ? value : this._defaultEdgeLabelFn(v, w, name);
        var edgeObj = edgeArgsToObj(this._isDirected, v, w, name);
        v = edgeObj.v;
        w = edgeObj.w;
        Object.freeze(edgeObj);
        this._edgeObjs[e] = edgeObj;
        incrementOrInitEntry(this._preds[w], v);
        incrementOrInitEntry(this._sucs[v], w);
        this._in[w][e] = edgeObj;
        this._out[v][e] = edgeObj;
        this._edgeCount++;
        return this;
      }
      /**
       * Gets the label for the specified edge.
       * Complexity: O(1).
       */
      edge(v, w, name) {
        var e = arguments.length === 1 ? edgeObjToId(this._isDirected, arguments[0]) : edgeArgsToId(this._isDirected, v, w, name);
        return this._edgeLabels[e];
      }
      /**
       * Gets the label for the specified edge and converts it to an object.
       * Complexity: O(1)
       */
      edgeAsObj() {
        const edge = this.edge(...arguments);
        if (typeof edge !== "object") {
          return { label: edge };
        }
        return edge;
      }
      /**
       * Detects whether the graph contains specified edge or not. No subgraphs are considered.
       * Complexity: O(1).
       */
      hasEdge(v, w, name) {
        var e = arguments.length === 1 ? edgeObjToId(this._isDirected, arguments[0]) : edgeArgsToId(this._isDirected, v, w, name);
        return Object.hasOwn(this._edgeLabels, e);
      }
      /**
       * Removes the specified edge from the graph. No subgraphs are considered.
       * Complexity: O(1).
       */
      removeEdge(v, w, name) {
        var e = arguments.length === 1 ? edgeObjToId(this._isDirected, arguments[0]) : edgeArgsToId(this._isDirected, v, w, name);
        var edge = this._edgeObjs[e];
        if (edge) {
          v = edge.v;
          w = edge.w;
          delete this._edgeLabels[e];
          delete this._edgeObjs[e];
          decrementOrRemoveEntry(this._preds[w], v);
          decrementOrRemoveEntry(this._sucs[v], w);
          delete this._in[w][e];
          delete this._out[v][e];
          this._edgeCount--;
        }
        return this;
      }
      /**
       * Return all edges that point to the node v. Optionally filters those edges down to just those
       * coming from node u. Behavior is undefined for undirected graphs - use nodeEdges instead.
       * Complexity: O(|E|).
       */
      inEdges(v, u) {
        var inV = this._in[v];
        if (inV) {
          var edges = Object.values(inV);
          if (!u) {
            return edges;
          }
          return edges.filter((edge) => edge.v === u);
        }
      }
      /**
       * Return all edges that are pointed at by node v. Optionally filters those edges down to just
       * those point to w. Behavior is undefined for undirected graphs - use nodeEdges instead.
       * Complexity: O(|E|).
       */
      outEdges(v, w) {
        var outV = this._out[v];
        if (outV) {
          var edges = Object.values(outV);
          if (!w) {
            return edges;
          }
          return edges.filter((edge) => edge.w === w);
        }
      }
      /**
       * Returns all edges to or from node v regardless of direction. Optionally filters those edges
       * down to just those between nodes v and w regardless of direction.
       * Complexity: O(|E|).
       */
      nodeEdges(v, w) {
        var inEdges = this.inEdges(v, w);
        if (inEdges) {
          return inEdges.concat(this.outEdges(v, w));
        }
      }
    };
    function incrementOrInitEntry(map, k) {
      if (map[k]) {
        map[k]++;
      } else {
        map[k] = 1;
      }
    }
    function decrementOrRemoveEntry(map, k) {
      if (!--map[k]) {
        delete map[k];
      }
    }
    function edgeArgsToId(isDirected, v_, w_, name) {
      var v = "" + v_;
      var w = "" + w_;
      if (!isDirected && v > w) {
        var tmp = v;
        v = w;
        w = tmp;
      }
      return v + EDGE_KEY_DELIM + w + EDGE_KEY_DELIM + (name === void 0 ? DEFAULT_EDGE_NAME : name);
    }
    function edgeArgsToObj(isDirected, v_, w_, name) {
      var v = "" + v_;
      var w = "" + w_;
      if (!isDirected && v > w) {
        var tmp = v;
        v = w;
        w = tmp;
      }
      var edgeObj = { v, w };
      if (name) {
        edgeObj.name = name;
      }
      return edgeObj;
    }
    function edgeObjToId(isDirected, edgeObj) {
      return edgeArgsToId(isDirected, edgeObj.v, edgeObj.w, edgeObj.name);
    }
    module2.exports = Graph;
  }
});

// node_modules/@dagrejs/graphlib/lib/version.js
var require_version = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/version.js"(exports2, module2) {
    module2.exports = "2.2.4";
  }
});

// node_modules/@dagrejs/graphlib/lib/index.js
var require_lib = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/index.js"(exports2, module2) {
    module2.exports = {
      Graph: require_graph(),
      version: require_version()
    };
  }
});

// node_modules/@dagrejs/graphlib/lib/json.js
var require_json = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/json.js"(exports2, module2) {
    var Graph = require_graph();
    module2.exports = {
      write,
      read
    };
    function write(g) {
      var json = {
        options: {
          directed: g.isDirected(),
          multigraph: g.isMultigraph(),
          compound: g.isCompound()
        },
        nodes: writeNodes(g),
        edges: writeEdges(g)
      };
      if (g.graph() !== void 0) {
        json.value = structuredClone(g.graph());
      }
      return json;
    }
    function writeNodes(g) {
      return g.nodes().map(function(v) {
        var nodeValue = g.node(v);
        var parent = g.parent(v);
        var node = { v };
        if (nodeValue !== void 0) {
          node.value = nodeValue;
        }
        if (parent !== void 0) {
          node.parent = parent;
        }
        return node;
      });
    }
    function writeEdges(g) {
      return g.edges().map(function(e) {
        var edgeValue = g.edge(e);
        var edge = { v: e.v, w: e.w };
        if (e.name !== void 0) {
          edge.name = e.name;
        }
        if (edgeValue !== void 0) {
          edge.value = edgeValue;
        }
        return edge;
      });
    }
    function read(json) {
      var g = new Graph(json.options).setGraph(json.value);
      json.nodes.forEach(function(entry) {
        g.setNode(entry.v, entry.value);
        if (entry.parent) {
          g.setParent(entry.v, entry.parent);
        }
      });
      json.edges.forEach(function(entry) {
        g.setEdge({ v: entry.v, w: entry.w, name: entry.name }, entry.value);
      });
      return g;
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/components.js
var require_components = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/components.js"(exports2, module2) {
    module2.exports = components;
    function components(g) {
      var visited = {};
      var cmpts = [];
      var cmpt;
      function dfs(v) {
        if (Object.hasOwn(visited, v)) return;
        visited[v] = true;
        cmpt.push(v);
        g.successors(v).forEach(dfs);
        g.predecessors(v).forEach(dfs);
      }
      g.nodes().forEach(function(v) {
        cmpt = [];
        dfs(v);
        if (cmpt.length) {
          cmpts.push(cmpt);
        }
      });
      return cmpts;
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/data/priority-queue.js
var require_priority_queue = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/data/priority-queue.js"(exports2, module2) {
    var PriorityQueue = class {
      _arr = [];
      _keyIndices = {};
      /**
       * Returns the number of elements in the queue. Takes `O(1)` time.
       */
      size() {
        return this._arr.length;
      }
      /**
       * Returns the keys that are in the queue. Takes `O(n)` time.
       */
      keys() {
        return this._arr.map(function(x) {
          return x.key;
        });
      }
      /**
       * Returns `true` if **key** is in the queue and `false` if not.
       */
      has(key) {
        return Object.hasOwn(this._keyIndices, key);
      }
      /**
       * Returns the priority for **key**. If **key** is not present in the queue
       * then this function returns `undefined`. Takes `O(1)` time.
       *
       * @param {Object} key
       */
      priority(key) {
        var index = this._keyIndices[key];
        if (index !== void 0) {
          return this._arr[index].priority;
        }
      }
      /**
       * Returns the key for the minimum element in this queue. If the queue is
       * empty this function throws an Error. Takes `O(1)` time.
       */
      min() {
        if (this.size() === 0) {
          throw new Error("Queue underflow");
        }
        return this._arr[0].key;
      }
      /**
       * Inserts a new key into the priority queue. If the key already exists in
       * the queue this function returns `false`; otherwise it will return `true`.
       * Takes `O(n)` time.
       *
       * @param {Object} key the key to add
       * @param {Number} priority the initial priority for the key
       */
      add(key, priority) {
        var keyIndices = this._keyIndices;
        key = String(key);
        if (!Object.hasOwn(keyIndices, key)) {
          var arr = this._arr;
          var index = arr.length;
          keyIndices[key] = index;
          arr.push({ key, priority });
          this._decrease(index);
          return true;
        }
        return false;
      }
      /**
       * Removes and returns the smallest key in the queue. Takes `O(log n)` time.
       */
      removeMin() {
        this._swap(0, this._arr.length - 1);
        var min = this._arr.pop();
        delete this._keyIndices[min.key];
        this._heapify(0);
        return min.key;
      }
      /**
       * Decreases the priority for **key** to **priority**. If the new priority is
       * greater than the previous priority, this function will throw an Error.
       *
       * @param {Object} key the key for which to raise priority
       * @param {Number} priority the new priority for the key
       */
      decrease(key, priority) {
        var index = this._keyIndices[key];
        if (priority > this._arr[index].priority) {
          throw new Error("New priority is greater than current priority. Key: " + key + " Old: " + this._arr[index].priority + " New: " + priority);
        }
        this._arr[index].priority = priority;
        this._decrease(index);
      }
      _heapify(i) {
        var arr = this._arr;
        var l = 2 * i;
        var r = l + 1;
        var largest = i;
        if (l < arr.length) {
          largest = arr[l].priority < arr[largest].priority ? l : largest;
          if (r < arr.length) {
            largest = arr[r].priority < arr[largest].priority ? r : largest;
          }
          if (largest !== i) {
            this._swap(i, largest);
            this._heapify(largest);
          }
        }
      }
      _decrease(index) {
        var arr = this._arr;
        var priority = arr[index].priority;
        var parent;
        while (index !== 0) {
          parent = index >> 1;
          if (arr[parent].priority < priority) {
            break;
          }
          this._swap(index, parent);
          index = parent;
        }
      }
      _swap(i, j) {
        var arr = this._arr;
        var keyIndices = this._keyIndices;
        var origArrI = arr[i];
        var origArrJ = arr[j];
        arr[i] = origArrJ;
        arr[j] = origArrI;
        keyIndices[origArrJ.key] = i;
        keyIndices[origArrI.key] = j;
      }
    };
    module2.exports = PriorityQueue;
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/dijkstra.js
var require_dijkstra = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/dijkstra.js"(exports2, module2) {
    var PriorityQueue = require_priority_queue();
    module2.exports = dijkstra;
    var DEFAULT_WEIGHT_FUNC = () => 1;
    function dijkstra(g, source, weightFn, edgeFn) {
      return runDijkstra(
        g,
        String(source),
        weightFn || DEFAULT_WEIGHT_FUNC,
        edgeFn || function(v) {
          return g.outEdges(v);
        }
      );
    }
    function runDijkstra(g, source, weightFn, edgeFn) {
      var results = {};
      var pq = new PriorityQueue();
      var v, vEntry;
      var updateNeighbors = function(edge) {
        var w = edge.v !== v ? edge.v : edge.w;
        var wEntry = results[w];
        var weight = weightFn(edge);
        var distance = vEntry.distance + weight;
        if (weight < 0) {
          throw new Error("dijkstra does not allow negative edge weights. Bad edge: " + edge + " Weight: " + weight);
        }
        if (distance < wEntry.distance) {
          wEntry.distance = distance;
          wEntry.predecessor = v;
          pq.decrease(w, distance);
        }
      };
      g.nodes().forEach(function(v2) {
        var distance = v2 === source ? 0 : Number.POSITIVE_INFINITY;
        results[v2] = { distance };
        pq.add(v2, distance);
      });
      while (pq.size() > 0) {
        v = pq.removeMin();
        vEntry = results[v];
        if (vEntry.distance === Number.POSITIVE_INFINITY) {
          break;
        }
        edgeFn(v).forEach(updateNeighbors);
      }
      return results;
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/dijkstra-all.js
var require_dijkstra_all = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/dijkstra-all.js"(exports2, module2) {
    var dijkstra = require_dijkstra();
    module2.exports = dijkstraAll;
    function dijkstraAll(g, weightFunc, edgeFunc) {
      return g.nodes().reduce(function(acc, v) {
        acc[v] = dijkstra(g, v, weightFunc, edgeFunc);
        return acc;
      }, {});
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/tarjan.js
var require_tarjan = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/tarjan.js"(exports2, module2) {
    module2.exports = tarjan;
    function tarjan(g) {
      var index = 0;
      var stack = [];
      var visited = {};
      var results = [];
      function dfs(v) {
        var entry = visited[v] = {
          onStack: true,
          lowlink: index,
          index: index++
        };
        stack.push(v);
        g.successors(v).forEach(function(w2) {
          if (!Object.hasOwn(visited, w2)) {
            dfs(w2);
            entry.lowlink = Math.min(entry.lowlink, visited[w2].lowlink);
          } else if (visited[w2].onStack) {
            entry.lowlink = Math.min(entry.lowlink, visited[w2].index);
          }
        });
        if (entry.lowlink === entry.index) {
          var cmpt = [];
          var w;
          do {
            w = stack.pop();
            visited[w].onStack = false;
            cmpt.push(w);
          } while (v !== w);
          results.push(cmpt);
        }
      }
      g.nodes().forEach(function(v) {
        if (!Object.hasOwn(visited, v)) {
          dfs(v);
        }
      });
      return results;
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/find-cycles.js
var require_find_cycles = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/find-cycles.js"(exports2, module2) {
    var tarjan = require_tarjan();
    module2.exports = findCycles;
    function findCycles(g) {
      return tarjan(g).filter(function(cmpt) {
        return cmpt.length > 1 || cmpt.length === 1 && g.hasEdge(cmpt[0], cmpt[0]);
      });
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/floyd-warshall.js
var require_floyd_warshall = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/floyd-warshall.js"(exports2, module2) {
    module2.exports = floydWarshall;
    var DEFAULT_WEIGHT_FUNC = () => 1;
    function floydWarshall(g, weightFn, edgeFn) {
      return runFloydWarshall(
        g,
        weightFn || DEFAULT_WEIGHT_FUNC,
        edgeFn || function(v) {
          return g.outEdges(v);
        }
      );
    }
    function runFloydWarshall(g, weightFn, edgeFn) {
      var results = {};
      var nodes = g.nodes();
      nodes.forEach(function(v) {
        results[v] = {};
        results[v][v] = { distance: 0 };
        nodes.forEach(function(w) {
          if (v !== w) {
            results[v][w] = { distance: Number.POSITIVE_INFINITY };
          }
        });
        edgeFn(v).forEach(function(edge) {
          var w = edge.v === v ? edge.w : edge.v;
          var d = weightFn(edge);
          results[v][w] = { distance: d, predecessor: v };
        });
      });
      nodes.forEach(function(k) {
        var rowK = results[k];
        nodes.forEach(function(i) {
          var rowI = results[i];
          nodes.forEach(function(j) {
            var ik = rowI[k];
            var kj = rowK[j];
            var ij = rowI[j];
            var altDistance = ik.distance + kj.distance;
            if (altDistance < ij.distance) {
              ij.distance = altDistance;
              ij.predecessor = kj.predecessor;
            }
          });
        });
      });
      return results;
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/topsort.js
var require_topsort = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/topsort.js"(exports2, module2) {
    function topsort(g) {
      var visited = {};
      var stack = {};
      var results = [];
      function visit(node) {
        if (Object.hasOwn(stack, node)) {
          throw new CycleException();
        }
        if (!Object.hasOwn(visited, node)) {
          stack[node] = true;
          visited[node] = true;
          g.predecessors(node).forEach(visit);
          delete stack[node];
          results.push(node);
        }
      }
      g.sinks().forEach(visit);
      if (Object.keys(visited).length !== g.nodeCount()) {
        throw new CycleException();
      }
      return results;
    }
    var CycleException = class extends Error {
      constructor() {
        super(...arguments);
      }
    };
    module2.exports = topsort;
    topsort.CycleException = CycleException;
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/is-acyclic.js
var require_is_acyclic = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/is-acyclic.js"(exports2, module2) {
    var topsort = require_topsort();
    module2.exports = isAcyclic;
    function isAcyclic(g) {
      try {
        topsort(g);
      } catch (e) {
        if (e instanceof topsort.CycleException) {
          return false;
        }
        throw e;
      }
      return true;
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/dfs.js
var require_dfs = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/dfs.js"(exports2, module2) {
    module2.exports = dfs;
    function dfs(g, vs, order) {
      if (!Array.isArray(vs)) {
        vs = [vs];
      }
      var navigation = g.isDirected() ? (v) => g.successors(v) : (v) => g.neighbors(v);
      var orderFunc = order === "post" ? postOrderDfs : preOrderDfs;
      var acc = [];
      var visited = {};
      vs.forEach((v) => {
        if (!g.hasNode(v)) {
          throw new Error("Graph does not have node: " + v);
        }
        orderFunc(v, navigation, visited, acc);
      });
      return acc;
    }
    function postOrderDfs(v, navigation, visited, acc) {
      var stack = [[v, false]];
      while (stack.length > 0) {
        var curr = stack.pop();
        if (curr[1]) {
          acc.push(curr[0]);
        } else {
          if (!Object.hasOwn(visited, curr[0])) {
            visited[curr[0]] = true;
            stack.push([curr[0], true]);
            forEachRight(navigation(curr[0]), (w) => stack.push([w, false]));
          }
        }
      }
    }
    function preOrderDfs(v, navigation, visited, acc) {
      var stack = [v];
      while (stack.length > 0) {
        var curr = stack.pop();
        if (!Object.hasOwn(visited, curr)) {
          visited[curr] = true;
          acc.push(curr);
          forEachRight(navigation(curr), (w) => stack.push(w));
        }
      }
    }
    function forEachRight(array, iteratee) {
      var length = array.length;
      while (length--) {
        iteratee(array[length], length, array);
      }
      return array;
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/postorder.js
var require_postorder = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/postorder.js"(exports2, module2) {
    var dfs = require_dfs();
    module2.exports = postorder;
    function postorder(g, vs) {
      return dfs(g, vs, "post");
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/preorder.js
var require_preorder = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/preorder.js"(exports2, module2) {
    var dfs = require_dfs();
    module2.exports = preorder;
    function preorder(g, vs) {
      return dfs(g, vs, "pre");
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/prim.js
var require_prim = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/prim.js"(exports2, module2) {
    var Graph = require_graph();
    var PriorityQueue = require_priority_queue();
    module2.exports = prim;
    function prim(g, weightFunc) {
      var result = new Graph();
      var parents = {};
      var pq = new PriorityQueue();
      var v;
      function updateNeighbors(edge) {
        var w = edge.v === v ? edge.w : edge.v;
        var pri = pq.priority(w);
        if (pri !== void 0) {
          var edgeWeight = weightFunc(edge);
          if (edgeWeight < pri) {
            parents[w] = v;
            pq.decrease(w, edgeWeight);
          }
        }
      }
      if (g.nodeCount() === 0) {
        return result;
      }
      g.nodes().forEach(function(v2) {
        pq.add(v2, Number.POSITIVE_INFINITY);
        result.setNode(v2);
      });
      pq.decrease(g.nodes()[0], 0);
      var init = false;
      while (pq.size() > 0) {
        v = pq.removeMin();
        if (Object.hasOwn(parents, v)) {
          result.setEdge(v, parents[v]);
        } else if (init) {
          throw new Error("Input graph is not connected: " + g);
        } else {
          init = true;
        }
        g.nodeEdges(v).forEach(updateNeighbors);
      }
      return result;
    }
  }
});

// node_modules/@dagrejs/graphlib/lib/alg/index.js
var require_alg = __commonJS({
  "node_modules/@dagrejs/graphlib/lib/alg/index.js"(exports2, module2) {
    module2.exports = {
      components: require_components(),
      dijkstra: require_dijkstra(),
      dijkstraAll: require_dijkstra_all(),
      findCycles: require_find_cycles(),
      floydWarshall: require_floyd_warshall(),
      isAcyclic: require_is_acyclic(),
      postorder: require_postorder(),
      preorder: require_preorder(),
      prim: require_prim(),
      tarjan: require_tarjan(),
      topsort: require_topsort()
    };
  }
});

// node_modules/@dagrejs/graphlib/index.js
var require_graphlib = __commonJS({
  "node_modules/@dagrejs/graphlib/index.js"(exports2, module2) {
    var lib = require_lib();
    module2.exports = {
      Graph: lib.Graph,
      json: require_json(),
      alg: require_alg(),
      version: lib.version
    };
  }
});

// node_modules/@dagrejs/dagre/lib/data/list.js
var require_list = __commonJS({
  "node_modules/@dagrejs/dagre/lib/data/list.js"(exports2, module2) {
    var List = class {
      constructor() {
        let sentinel = {};
        sentinel._next = sentinel._prev = sentinel;
        this._sentinel = sentinel;
      }
      dequeue() {
        let sentinel = this._sentinel;
        let entry = sentinel._prev;
        if (entry !== sentinel) {
          unlink(entry);
          return entry;
        }
      }
      enqueue(entry) {
        let sentinel = this._sentinel;
        if (entry._prev && entry._next) {
          unlink(entry);
        }
        entry._next = sentinel._next;
        sentinel._next._prev = entry;
        sentinel._next = entry;
        entry._prev = sentinel;
      }
      toString() {
        let strs = [];
        let sentinel = this._sentinel;
        let curr = sentinel._prev;
        while (curr !== sentinel) {
          strs.push(JSON.stringify(curr, filterOutLinks));
          curr = curr._prev;
        }
        return "[" + strs.join(", ") + "]";
      }
    };
    function unlink(entry) {
      entry._prev._next = entry._next;
      entry._next._prev = entry._prev;
      delete entry._next;
      delete entry._prev;
    }
    function filterOutLinks(k, v) {
      if (k !== "_next" && k !== "_prev") {
        return v;
      }
    }
    module2.exports = List;
  }
});

// node_modules/@dagrejs/dagre/lib/greedy-fas.js
var require_greedy_fas = __commonJS({
  "node_modules/@dagrejs/dagre/lib/greedy-fas.js"(exports2, module2) {
    var Graph = require_graphlib().Graph;
    var List = require_list();
    module2.exports = greedyFAS;
    var DEFAULT_WEIGHT_FN = () => 1;
    function greedyFAS(g, weightFn) {
      if (g.nodeCount() <= 1) {
        return [];
      }
      let state = buildState(g, weightFn || DEFAULT_WEIGHT_FN);
      let results = doGreedyFAS(state.graph, state.buckets, state.zeroIdx);
      return results.flatMap((e) => g.outEdges(e.v, e.w));
    }
    function doGreedyFAS(g, buckets, zeroIdx) {
      let results = [];
      let sources = buckets[buckets.length - 1];
      let sinks = buckets[0];
      let entry;
      while (g.nodeCount()) {
        while (entry = sinks.dequeue()) {
          removeNode(g, buckets, zeroIdx, entry);
        }
        while (entry = sources.dequeue()) {
          removeNode(g, buckets, zeroIdx, entry);
        }
        if (g.nodeCount()) {
          for (let i = buckets.length - 2; i > 0; --i) {
            entry = buckets[i].dequeue();
            if (entry) {
              results = results.concat(removeNode(g, buckets, zeroIdx, entry, true));
              break;
            }
          }
        }
      }
      return results;
    }
    function removeNode(g, buckets, zeroIdx, entry, collectPredecessors) {
      let results = collectPredecessors ? [] : void 0;
      g.inEdges(entry.v).forEach((edge) => {
        let weight = g.edge(edge);
        let uEntry = g.node(edge.v);
        if (collectPredecessors) {
          results.push({ v: edge.v, w: edge.w });
        }
        uEntry.out -= weight;
        assignBucket(buckets, zeroIdx, uEntry);
      });
      g.outEdges(entry.v).forEach((edge) => {
        let weight = g.edge(edge);
        let w = edge.w;
        let wEntry = g.node(w);
        wEntry["in"] -= weight;
        assignBucket(buckets, zeroIdx, wEntry);
      });
      g.removeNode(entry.v);
      return results;
    }
    function buildState(g, weightFn) {
      let fasGraph = new Graph();
      let maxIn = 0;
      let maxOut = 0;
      g.nodes().forEach((v) => {
        fasGraph.setNode(v, { v, "in": 0, out: 0 });
      });
      g.edges().forEach((e) => {
        let prevWeight = fasGraph.edge(e.v, e.w) || 0;
        let weight = weightFn(e);
        let edgeWeight = prevWeight + weight;
        fasGraph.setEdge(e.v, e.w, edgeWeight);
        maxOut = Math.max(maxOut, fasGraph.node(e.v).out += weight);
        maxIn = Math.max(maxIn, fasGraph.node(e.w)["in"] += weight);
      });
      let buckets = range(maxOut + maxIn + 3).map(() => new List());
      let zeroIdx = maxIn + 1;
      fasGraph.nodes().forEach((v) => {
        assignBucket(buckets, zeroIdx, fasGraph.node(v));
      });
      return { graph: fasGraph, buckets, zeroIdx };
    }
    function assignBucket(buckets, zeroIdx, entry) {
      if (!entry.out) {
        buckets[0].enqueue(entry);
      } else if (!entry["in"]) {
        buckets[buckets.length - 1].enqueue(entry);
      } else {
        buckets[entry.out - entry["in"] + zeroIdx].enqueue(entry);
      }
    }
    function range(limit) {
      const range2 = [];
      for (let i = 0; i < limit; i++) {
        range2.push(i);
      }
      return range2;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/util.js
var require_util = __commonJS({
  "node_modules/@dagrejs/dagre/lib/util.js"(exports2, module2) {
    "use strict";
    var Graph = require_graphlib().Graph;
    module2.exports = {
      addBorderNode,
      addDummyNode,
      applyWithChunking,
      asNonCompoundGraph,
      buildLayerMatrix,
      intersectRect,
      mapValues,
      maxRank,
      normalizeRanks,
      notime,
      partition,
      pick,
      predecessorWeights,
      range,
      removeEmptyRanks,
      simplify,
      successorWeights,
      time,
      uniqueId,
      zipObject
    };
    function addDummyNode(g, type, attrs, name) {
      var v = name;
      while (g.hasNode(v)) {
        v = uniqueId(name);
      }
      attrs.dummy = type;
      g.setNode(v, attrs);
      return v;
    }
    function simplify(g) {
      let simplified = new Graph().setGraph(g.graph());
      g.nodes().forEach((v) => simplified.setNode(v, g.node(v)));
      g.edges().forEach((e) => {
        let simpleLabel = simplified.edge(e.v, e.w) || { weight: 0, minlen: 1 };
        let label = g.edge(e);
        simplified.setEdge(e.v, e.w, {
          weight: simpleLabel.weight + label.weight,
          minlen: Math.max(simpleLabel.minlen, label.minlen)
        });
      });
      return simplified;
    }
    function asNonCompoundGraph(g) {
      let simplified = new Graph({ multigraph: g.isMultigraph() }).setGraph(g.graph());
      g.nodes().forEach((v) => {
        if (!g.children(v).length) {
          simplified.setNode(v, g.node(v));
        }
      });
      g.edges().forEach((e) => {
        simplified.setEdge(e, g.edge(e));
      });
      return simplified;
    }
    function successorWeights(g) {
      let weightMap = g.nodes().map((v) => {
        let sucs = {};
        g.outEdges(v).forEach((e) => {
          sucs[e.w] = (sucs[e.w] || 0) + g.edge(e).weight;
        });
        return sucs;
      });
      return zipObject(g.nodes(), weightMap);
    }
    function predecessorWeights(g) {
      let weightMap = g.nodes().map((v) => {
        let preds = {};
        g.inEdges(v).forEach((e) => {
          preds[e.v] = (preds[e.v] || 0) + g.edge(e).weight;
        });
        return preds;
      });
      return zipObject(g.nodes(), weightMap);
    }
    function intersectRect(rect, point) {
      let x = rect.x;
      let y = rect.y;
      let dx = point.x - x;
      let dy = point.y - y;
      let w = rect.width / 2;
      let h = rect.height / 2;
      if (!dx && !dy) {
        throw new Error("Not possible to find intersection inside of the rectangle");
      }
      let sx, sy;
      if (Math.abs(dy) * w > Math.abs(dx) * h) {
        if (dy < 0) {
          h = -h;
        }
        sx = h * dx / dy;
        sy = h;
      } else {
        if (dx < 0) {
          w = -w;
        }
        sx = w;
        sy = w * dy / dx;
      }
      return { x: x + sx, y: y + sy };
    }
    function buildLayerMatrix(g) {
      let layering = range(maxRank(g) + 1).map(() => []);
      g.nodes().forEach((v) => {
        let node = g.node(v);
        let rank = node.rank;
        if (rank !== void 0) {
          layering[rank][node.order] = v;
        }
      });
      return layering;
    }
    function normalizeRanks(g) {
      let nodeRanks = g.nodes().map((v) => {
        let rank = g.node(v).rank;
        if (rank === void 0) {
          return Number.MAX_VALUE;
        }
        return rank;
      });
      let min = applyWithChunking(Math.min, nodeRanks);
      g.nodes().forEach((v) => {
        let node = g.node(v);
        if (Object.hasOwn(node, "rank")) {
          node.rank -= min;
        }
      });
    }
    function removeEmptyRanks(g) {
      let nodeRanks = g.nodes().map((v) => g.node(v).rank);
      let offset = applyWithChunking(Math.min, nodeRanks);
      let layers = [];
      g.nodes().forEach((v) => {
        let rank = g.node(v).rank - offset;
        if (!layers[rank]) {
          layers[rank] = [];
        }
        layers[rank].push(v);
      });
      let delta = 0;
      let nodeRankFactor = g.graph().nodeRankFactor;
      Array.from(layers).forEach((vs, i) => {
        if (vs === void 0 && i % nodeRankFactor !== 0) {
          --delta;
        } else if (vs !== void 0 && delta) {
          vs.forEach((v) => g.node(v).rank += delta);
        }
      });
    }
    function addBorderNode(g, prefix, rank, order) {
      let node = {
        width: 0,
        height: 0
      };
      if (arguments.length >= 4) {
        node.rank = rank;
        node.order = order;
      }
      return addDummyNode(g, "border", node, prefix);
    }
    function splitToChunks(array, chunkSize = CHUNKING_THRESHOLD) {
      const chunks = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);
        chunks.push(chunk);
      }
      return chunks;
    }
    var CHUNKING_THRESHOLD = 65535;
    function applyWithChunking(fn, argsArray) {
      if (argsArray.length > CHUNKING_THRESHOLD) {
        const chunks = splitToChunks(argsArray);
        return fn.apply(null, chunks.map((chunk) => fn.apply(null, chunk)));
      } else {
        return fn.apply(null, argsArray);
      }
    }
    function maxRank(g) {
      const nodes = g.nodes();
      const nodeRanks = nodes.map((v) => {
        let rank = g.node(v).rank;
        if (rank === void 0) {
          return Number.MIN_VALUE;
        }
        return rank;
      });
      return applyWithChunking(Math.max, nodeRanks);
    }
    function partition(collection, fn) {
      let result = { lhs: [], rhs: [] };
      collection.forEach((value) => {
        if (fn(value)) {
          result.lhs.push(value);
        } else {
          result.rhs.push(value);
        }
      });
      return result;
    }
    function time(name, fn) {
      let start = Date.now();
      try {
        return fn();
      } finally {
        console.log(name + " time: " + (Date.now() - start) + "ms");
      }
    }
    function notime(name, fn) {
      return fn();
    }
    var idCounter = 0;
    function uniqueId(prefix) {
      var id = ++idCounter;
      return prefix + ("" + id);
    }
    function range(start, limit, step = 1) {
      if (limit == null) {
        limit = start;
        start = 0;
      }
      let endCon = (i) => i < limit;
      if (step < 0) {
        endCon = (i) => limit < i;
      }
      const range2 = [];
      for (let i = start; endCon(i); i += step) {
        range2.push(i);
      }
      return range2;
    }
    function pick(source, keys) {
      const dest = {};
      for (const key of keys) {
        if (source[key] !== void 0) {
          dest[key] = source[key];
        }
      }
      return dest;
    }
    function mapValues(obj, funcOrProp) {
      let func = funcOrProp;
      if (typeof funcOrProp === "string") {
        func = (val) => val[funcOrProp];
      }
      return Object.entries(obj).reduce((acc, [k, v]) => {
        acc[k] = func(v, k);
        return acc;
      }, {});
    }
    function zipObject(props, values) {
      return props.reduce((acc, key, i) => {
        acc[key] = values[i];
        return acc;
      }, {});
    }
  }
});

// node_modules/@dagrejs/dagre/lib/acyclic.js
var require_acyclic = __commonJS({
  "node_modules/@dagrejs/dagre/lib/acyclic.js"(exports2, module2) {
    "use strict";
    var greedyFAS = require_greedy_fas();
    var uniqueId = require_util().uniqueId;
    module2.exports = {
      run,
      undo
    };
    function run(g) {
      let fas = g.graph().acyclicer === "greedy" ? greedyFAS(g, weightFn(g)) : dfsFAS(g);
      fas.forEach((e) => {
        let label = g.edge(e);
        g.removeEdge(e);
        label.forwardName = e.name;
        label.reversed = true;
        g.setEdge(e.w, e.v, label, uniqueId("rev"));
      });
      function weightFn(g2) {
        return (e) => {
          return g2.edge(e).weight;
        };
      }
    }
    function dfsFAS(g) {
      let fas = [];
      let stack = {};
      let visited = {};
      function dfs(v) {
        if (Object.hasOwn(visited, v)) {
          return;
        }
        visited[v] = true;
        stack[v] = true;
        g.outEdges(v).forEach((e) => {
          if (Object.hasOwn(stack, e.w)) {
            fas.push(e);
          } else {
            dfs(e.w);
          }
        });
        delete stack[v];
      }
      g.nodes().forEach(dfs);
      return fas;
    }
    function undo(g) {
      g.edges().forEach((e) => {
        let label = g.edge(e);
        if (label.reversed) {
          g.removeEdge(e);
          let forwardName = label.forwardName;
          delete label.reversed;
          delete label.forwardName;
          g.setEdge(e.w, e.v, label, forwardName);
        }
      });
    }
  }
});

// node_modules/@dagrejs/dagre/lib/normalize.js
var require_normalize = __commonJS({
  "node_modules/@dagrejs/dagre/lib/normalize.js"(exports2, module2) {
    "use strict";
    var util = require_util();
    module2.exports = {
      run,
      undo
    };
    function run(g) {
      g.graph().dummyChains = [];
      g.edges().forEach((edge) => normalizeEdge(g, edge));
    }
    function normalizeEdge(g, e) {
      let v = e.v;
      let vRank = g.node(v).rank;
      let w = e.w;
      let wRank = g.node(w).rank;
      let name = e.name;
      let edgeLabel = g.edge(e);
      let labelRank = edgeLabel.labelRank;
      if (wRank === vRank + 1) return;
      g.removeEdge(e);
      let dummy, attrs, i;
      for (i = 0, ++vRank; vRank < wRank; ++i, ++vRank) {
        edgeLabel.points = [];
        attrs = {
          width: 0,
          height: 0,
          edgeLabel,
          edgeObj: e,
          rank: vRank
        };
        dummy = util.addDummyNode(g, "edge", attrs, "_d");
        if (vRank === labelRank) {
          attrs.width = edgeLabel.width;
          attrs.height = edgeLabel.height;
          attrs.dummy = "edge-label";
          attrs.labelpos = edgeLabel.labelpos;
        }
        g.setEdge(v, dummy, { weight: edgeLabel.weight }, name);
        if (i === 0) {
          g.graph().dummyChains.push(dummy);
        }
        v = dummy;
      }
      g.setEdge(v, w, { weight: edgeLabel.weight }, name);
    }
    function undo(g) {
      g.graph().dummyChains.forEach((v) => {
        let node = g.node(v);
        let origLabel = node.edgeLabel;
        let w;
        g.setEdge(node.edgeObj, origLabel);
        while (node.dummy) {
          w = g.successors(v)[0];
          g.removeNode(v);
          origLabel.points.push({ x: node.x, y: node.y });
          if (node.dummy === "edge-label") {
            origLabel.x = node.x;
            origLabel.y = node.y;
            origLabel.width = node.width;
            origLabel.height = node.height;
          }
          v = w;
          node = g.node(v);
        }
      });
    }
  }
});

// node_modules/@dagrejs/dagre/lib/rank/util.js
var require_util2 = __commonJS({
  "node_modules/@dagrejs/dagre/lib/rank/util.js"(exports2, module2) {
    "use strict";
    var { applyWithChunking } = require_util();
    module2.exports = {
      longestPath,
      slack
    };
    function longestPath(g) {
      var visited = {};
      function dfs(v) {
        var label = g.node(v);
        if (Object.hasOwn(visited, v)) {
          return label.rank;
        }
        visited[v] = true;
        let outEdgesMinLens = g.outEdges(v).map((e) => {
          if (e == null) {
            return Number.POSITIVE_INFINITY;
          }
          return dfs(e.w) - g.edge(e).minlen;
        });
        var rank = applyWithChunking(Math.min, outEdgesMinLens);
        if (rank === Number.POSITIVE_INFINITY) {
          rank = 0;
        }
        return label.rank = rank;
      }
      g.sources().forEach(dfs);
    }
    function slack(g, e) {
      return g.node(e.w).rank - g.node(e.v).rank - g.edge(e).minlen;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/rank/feasible-tree.js
var require_feasible_tree = __commonJS({
  "node_modules/@dagrejs/dagre/lib/rank/feasible-tree.js"(exports2, module2) {
    "use strict";
    var Graph = require_graphlib().Graph;
    var slack = require_util2().slack;
    module2.exports = feasibleTree;
    function feasibleTree(g) {
      var t = new Graph({ directed: false });
      var start = g.nodes()[0];
      var size = g.nodeCount();
      t.setNode(start, {});
      var edge, delta;
      while (tightTree(t, g) < size) {
        edge = findMinSlackEdge(t, g);
        delta = t.hasNode(edge.v) ? slack(g, edge) : -slack(g, edge);
        shiftRanks(t, g, delta);
      }
      return t;
    }
    function tightTree(t, g) {
      function dfs(v) {
        g.nodeEdges(v).forEach((e) => {
          var edgeV = e.v, w = v === edgeV ? e.w : edgeV;
          if (!t.hasNode(w) && !slack(g, e)) {
            t.setNode(w, {});
            t.setEdge(v, w, {});
            dfs(w);
          }
        });
      }
      t.nodes().forEach(dfs);
      return t.nodeCount();
    }
    function findMinSlackEdge(t, g) {
      const edges = g.edges();
      return edges.reduce((acc, edge) => {
        let edgeSlack = Number.POSITIVE_INFINITY;
        if (t.hasNode(edge.v) !== t.hasNode(edge.w)) {
          edgeSlack = slack(g, edge);
        }
        if (edgeSlack < acc[0]) {
          return [edgeSlack, edge];
        }
        return acc;
      }, [Number.POSITIVE_INFINITY, null])[1];
    }
    function shiftRanks(t, g, delta) {
      t.nodes().forEach((v) => g.node(v).rank += delta);
    }
  }
});

// node_modules/@dagrejs/dagre/lib/rank/network-simplex.js
var require_network_simplex = __commonJS({
  "node_modules/@dagrejs/dagre/lib/rank/network-simplex.js"(exports2, module2) {
    "use strict";
    var feasibleTree = require_feasible_tree();
    var slack = require_util2().slack;
    var initRank = require_util2().longestPath;
    var preorder = require_graphlib().alg.preorder;
    var postorder = require_graphlib().alg.postorder;
    var simplify = require_util().simplify;
    module2.exports = networkSimplex;
    networkSimplex.initLowLimValues = initLowLimValues;
    networkSimplex.initCutValues = initCutValues;
    networkSimplex.calcCutValue = calcCutValue;
    networkSimplex.leaveEdge = leaveEdge;
    networkSimplex.enterEdge = enterEdge;
    networkSimplex.exchangeEdges = exchangeEdges;
    function networkSimplex(g) {
      g = simplify(g);
      initRank(g);
      var t = feasibleTree(g);
      initLowLimValues(t);
      initCutValues(t, g);
      var e, f;
      while (e = leaveEdge(t)) {
        f = enterEdge(t, g, e);
        exchangeEdges(t, g, e, f);
      }
    }
    function initCutValues(t, g) {
      var vs = postorder(t, t.nodes());
      vs = vs.slice(0, vs.length - 1);
      vs.forEach((v) => assignCutValue(t, g, v));
    }
    function assignCutValue(t, g, child) {
      var childLab = t.node(child);
      var parent = childLab.parent;
      t.edge(child, parent).cutvalue = calcCutValue(t, g, child);
    }
    function calcCutValue(t, g, child) {
      var childLab = t.node(child);
      var parent = childLab.parent;
      var childIsTail = true;
      var graphEdge = g.edge(child, parent);
      var cutValue = 0;
      if (!graphEdge) {
        childIsTail = false;
        graphEdge = g.edge(parent, child);
      }
      cutValue = graphEdge.weight;
      g.nodeEdges(child).forEach((e) => {
        var isOutEdge = e.v === child, other = isOutEdge ? e.w : e.v;
        if (other !== parent) {
          var pointsToHead = isOutEdge === childIsTail, otherWeight = g.edge(e).weight;
          cutValue += pointsToHead ? otherWeight : -otherWeight;
          if (isTreeEdge(t, child, other)) {
            var otherCutValue = t.edge(child, other).cutvalue;
            cutValue += pointsToHead ? -otherCutValue : otherCutValue;
          }
        }
      });
      return cutValue;
    }
    function initLowLimValues(tree, root) {
      if (arguments.length < 2) {
        root = tree.nodes()[0];
      }
      dfsAssignLowLim(tree, {}, 1, root);
    }
    function dfsAssignLowLim(tree, visited, nextLim, v, parent) {
      var low = nextLim;
      var label = tree.node(v);
      visited[v] = true;
      tree.neighbors(v).forEach((w) => {
        if (!Object.hasOwn(visited, w)) {
          nextLim = dfsAssignLowLim(tree, visited, nextLim, w, v);
        }
      });
      label.low = low;
      label.lim = nextLim++;
      if (parent) {
        label.parent = parent;
      } else {
        delete label.parent;
      }
      return nextLim;
    }
    function leaveEdge(tree) {
      return tree.edges().find((e) => tree.edge(e).cutvalue < 0);
    }
    function enterEdge(t, g, edge) {
      var v = edge.v;
      var w = edge.w;
      if (!g.hasEdge(v, w)) {
        v = edge.w;
        w = edge.v;
      }
      var vLabel = t.node(v);
      var wLabel = t.node(w);
      var tailLabel = vLabel;
      var flip = false;
      if (vLabel.lim > wLabel.lim) {
        tailLabel = wLabel;
        flip = true;
      }
      var candidates = g.edges().filter((edge2) => {
        return flip === isDescendant(t, t.node(edge2.v), tailLabel) && flip !== isDescendant(t, t.node(edge2.w), tailLabel);
      });
      return candidates.reduce((acc, edge2) => {
        if (slack(g, edge2) < slack(g, acc)) {
          return edge2;
        }
        return acc;
      });
    }
    function exchangeEdges(t, g, e, f) {
      var v = e.v;
      var w = e.w;
      t.removeEdge(v, w);
      t.setEdge(f.v, f.w, {});
      initLowLimValues(t);
      initCutValues(t, g);
      updateRanks(t, g);
    }
    function updateRanks(t, g) {
      var root = t.nodes().find((v) => !g.node(v).parent);
      var vs = preorder(t, root);
      vs = vs.slice(1);
      vs.forEach((v) => {
        var parent = t.node(v).parent, edge = g.edge(v, parent), flipped = false;
        if (!edge) {
          edge = g.edge(parent, v);
          flipped = true;
        }
        g.node(v).rank = g.node(parent).rank + (flipped ? edge.minlen : -edge.minlen);
      });
    }
    function isTreeEdge(tree, u, v) {
      return tree.hasEdge(u, v);
    }
    function isDescendant(tree, vLabel, rootLabel) {
      return rootLabel.low <= vLabel.lim && vLabel.lim <= rootLabel.lim;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/rank/index.js
var require_rank = __commonJS({
  "node_modules/@dagrejs/dagre/lib/rank/index.js"(exports2, module2) {
    "use strict";
    var rankUtil = require_util2();
    var longestPath = rankUtil.longestPath;
    var feasibleTree = require_feasible_tree();
    var networkSimplex = require_network_simplex();
    module2.exports = rank;
    function rank(g) {
      var ranker = g.graph().ranker;
      if (ranker instanceof Function) {
        return ranker(g);
      }
      switch (g.graph().ranker) {
        case "network-simplex":
          networkSimplexRanker(g);
          break;
        case "tight-tree":
          tightTreeRanker(g);
          break;
        case "longest-path":
          longestPathRanker(g);
          break;
        case "none":
          break;
        default:
          networkSimplexRanker(g);
      }
    }
    var longestPathRanker = longestPath;
    function tightTreeRanker(g) {
      longestPath(g);
      feasibleTree(g);
    }
    function networkSimplexRanker(g) {
      networkSimplex(g);
    }
  }
});

// node_modules/@dagrejs/dagre/lib/parent-dummy-chains.js
var require_parent_dummy_chains = __commonJS({
  "node_modules/@dagrejs/dagre/lib/parent-dummy-chains.js"(exports2, module2) {
    module2.exports = parentDummyChains;
    function parentDummyChains(g) {
      let postorderNums = postorder(g);
      g.graph().dummyChains.forEach((v) => {
        let node = g.node(v);
        let edgeObj = node.edgeObj;
        let pathData = findPath(g, postorderNums, edgeObj.v, edgeObj.w);
        let path3 = pathData.path;
        let lca = pathData.lca;
        let pathIdx = 0;
        let pathV = path3[pathIdx];
        let ascending = true;
        while (v !== edgeObj.w) {
          node = g.node(v);
          if (ascending) {
            while ((pathV = path3[pathIdx]) !== lca && g.node(pathV).maxRank < node.rank) {
              pathIdx++;
            }
            if (pathV === lca) {
              ascending = false;
            }
          }
          if (!ascending) {
            while (pathIdx < path3.length - 1 && g.node(pathV = path3[pathIdx + 1]).minRank <= node.rank) {
              pathIdx++;
            }
            pathV = path3[pathIdx];
          }
          g.setParent(v, pathV);
          v = g.successors(v)[0];
        }
      });
    }
    function findPath(g, postorderNums, v, w) {
      let vPath = [];
      let wPath = [];
      let low = Math.min(postorderNums[v].low, postorderNums[w].low);
      let lim = Math.max(postorderNums[v].lim, postorderNums[w].lim);
      let parent;
      let lca;
      parent = v;
      do {
        parent = g.parent(parent);
        vPath.push(parent);
      } while (parent && (postorderNums[parent].low > low || lim > postorderNums[parent].lim));
      lca = parent;
      parent = w;
      while ((parent = g.parent(parent)) !== lca) {
        wPath.push(parent);
      }
      return { path: vPath.concat(wPath.reverse()), lca };
    }
    function postorder(g) {
      let result = {};
      let lim = 0;
      function dfs(v) {
        let low = lim;
        g.children(v).forEach(dfs);
        result[v] = { low, lim: lim++ };
      }
      g.children().forEach(dfs);
      return result;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/nesting-graph.js
var require_nesting_graph = __commonJS({
  "node_modules/@dagrejs/dagre/lib/nesting-graph.js"(exports2, module2) {
    var util = require_util();
    module2.exports = {
      run,
      cleanup
    };
    function run(g) {
      let root = util.addDummyNode(g, "root", {}, "_root");
      let depths = treeDepths(g);
      let depthsArr = Object.values(depths);
      let height = util.applyWithChunking(Math.max, depthsArr) - 1;
      let nodeSep = 2 * height + 1;
      g.graph().nestingRoot = root;
      g.edges().forEach((e) => g.edge(e).minlen *= nodeSep);
      let weight = sumWeights(g) + 1;
      g.children().forEach((child) => dfs(g, root, nodeSep, weight, height, depths, child));
      g.graph().nodeRankFactor = nodeSep;
    }
    function dfs(g, root, nodeSep, weight, height, depths, v) {
      let children = g.children(v);
      if (!children.length) {
        if (v !== root) {
          g.setEdge(root, v, { weight: 0, minlen: nodeSep });
        }
        return;
      }
      let top = util.addBorderNode(g, "_bt");
      let bottom = util.addBorderNode(g, "_bb");
      let label = g.node(v);
      g.setParent(top, v);
      label.borderTop = top;
      g.setParent(bottom, v);
      label.borderBottom = bottom;
      children.forEach((child) => {
        dfs(g, root, nodeSep, weight, height, depths, child);
        let childNode = g.node(child);
        let childTop = childNode.borderTop ? childNode.borderTop : child;
        let childBottom = childNode.borderBottom ? childNode.borderBottom : child;
        let thisWeight = childNode.borderTop ? weight : 2 * weight;
        let minlen = childTop !== childBottom ? 1 : height - depths[v] + 1;
        g.setEdge(top, childTop, {
          weight: thisWeight,
          minlen,
          nestingEdge: true
        });
        g.setEdge(childBottom, bottom, {
          weight: thisWeight,
          minlen,
          nestingEdge: true
        });
      });
      if (!g.parent(v)) {
        g.setEdge(root, top, { weight: 0, minlen: height + depths[v] });
      }
    }
    function treeDepths(g) {
      var depths = {};
      function dfs2(v, depth) {
        var children = g.children(v);
        if (children && children.length) {
          children.forEach((child) => dfs2(child, depth + 1));
        }
        depths[v] = depth;
      }
      g.children().forEach((v) => dfs2(v, 1));
      return depths;
    }
    function sumWeights(g) {
      return g.edges().reduce((acc, e) => acc + g.edge(e).weight, 0);
    }
    function cleanup(g) {
      var graphLabel = g.graph();
      g.removeNode(graphLabel.nestingRoot);
      delete graphLabel.nestingRoot;
      g.edges().forEach((e) => {
        var edge = g.edge(e);
        if (edge.nestingEdge) {
          g.removeEdge(e);
        }
      });
    }
  }
});

// node_modules/@dagrejs/dagre/lib/add-border-segments.js
var require_add_border_segments = __commonJS({
  "node_modules/@dagrejs/dagre/lib/add-border-segments.js"(exports2, module2) {
    var util = require_util();
    module2.exports = addBorderSegments;
    function addBorderSegments(g) {
      function dfs(v) {
        let children = g.children(v);
        let node = g.node(v);
        if (children.length) {
          children.forEach(dfs);
        }
        if (Object.hasOwn(node, "minRank")) {
          node.borderLeft = [];
          node.borderRight = [];
          for (let rank = node.minRank, maxRank = node.maxRank + 1; rank < maxRank; ++rank) {
            addBorderNode(g, "borderLeft", "_bl", v, node, rank);
            addBorderNode(g, "borderRight", "_br", v, node, rank);
          }
        }
      }
      g.children().forEach(dfs);
    }
    function addBorderNode(g, prop, prefix, sg, sgNode, rank) {
      let label = { width: 0, height: 0, rank, borderType: prop };
      let prev = sgNode[prop][rank - 1];
      let curr = util.addDummyNode(g, "border", label, prefix);
      sgNode[prop][rank] = curr;
      g.setParent(curr, sg);
      if (prev) {
        g.setEdge(prev, curr, { weight: 1 });
      }
    }
  }
});

// node_modules/@dagrejs/dagre/lib/coordinate-system.js
var require_coordinate_system = __commonJS({
  "node_modules/@dagrejs/dagre/lib/coordinate-system.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      adjust,
      undo
    };
    function adjust(g) {
      let rankDir = g.graph().rankdir.toLowerCase();
      if (rankDir === "lr" || rankDir === "rl") {
        swapWidthHeight(g);
      }
    }
    function undo(g) {
      let rankDir = g.graph().rankdir.toLowerCase();
      if (rankDir === "bt" || rankDir === "rl") {
        reverseY(g);
      }
      if (rankDir === "lr" || rankDir === "rl") {
        swapXY(g);
        swapWidthHeight(g);
      }
    }
    function swapWidthHeight(g) {
      g.nodes().forEach((v) => swapWidthHeightOne(g.node(v)));
      g.edges().forEach((e) => swapWidthHeightOne(g.edge(e)));
    }
    function swapWidthHeightOne(attrs) {
      let w = attrs.width;
      attrs.width = attrs.height;
      attrs.height = w;
    }
    function reverseY(g) {
      g.nodes().forEach((v) => reverseYOne(g.node(v)));
      g.edges().forEach((e) => {
        let edge = g.edge(e);
        edge.points.forEach(reverseYOne);
        if (Object.hasOwn(edge, "y")) {
          reverseYOne(edge);
        }
      });
    }
    function reverseYOne(attrs) {
      attrs.y = -attrs.y;
    }
    function swapXY(g) {
      g.nodes().forEach((v) => swapXYOne(g.node(v)));
      g.edges().forEach((e) => {
        let edge = g.edge(e);
        edge.points.forEach(swapXYOne);
        if (Object.hasOwn(edge, "x")) {
          swapXYOne(edge);
        }
      });
    }
    function swapXYOne(attrs) {
      let x = attrs.x;
      attrs.x = attrs.y;
      attrs.y = x;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/order/init-order.js
var require_init_order = __commonJS({
  "node_modules/@dagrejs/dagre/lib/order/init-order.js"(exports2, module2) {
    "use strict";
    var util = require_util();
    module2.exports = initOrder;
    function initOrder(g) {
      let visited = {};
      let simpleNodes = g.nodes().filter((v) => !g.children(v).length);
      let simpleNodesRanks = simpleNodes.map((v) => g.node(v).rank);
      let maxRank = util.applyWithChunking(Math.max, simpleNodesRanks);
      let layers = util.range(maxRank + 1).map(() => []);
      function dfs(v) {
        if (visited[v]) return;
        visited[v] = true;
        let node = g.node(v);
        layers[node.rank].push(v);
        g.successors(v).forEach(dfs);
      }
      let orderedVs = simpleNodes.sort((a, b) => g.node(a).rank - g.node(b).rank);
      orderedVs.forEach(dfs);
      return layers;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/order/cross-count.js
var require_cross_count = __commonJS({
  "node_modules/@dagrejs/dagre/lib/order/cross-count.js"(exports2, module2) {
    "use strict";
    var zipObject = require_util().zipObject;
    module2.exports = crossCount;
    function crossCount(g, layering) {
      let cc = 0;
      for (let i = 1; i < layering.length; ++i) {
        cc += twoLayerCrossCount(g, layering[i - 1], layering[i]);
      }
      return cc;
    }
    function twoLayerCrossCount(g, northLayer, southLayer) {
      let southPos = zipObject(southLayer, southLayer.map((v, i) => i));
      let southEntries = northLayer.flatMap((v) => {
        return g.outEdges(v).map((e) => {
          return { pos: southPos[e.w], weight: g.edge(e).weight };
        }).sort((a, b) => a.pos - b.pos);
      });
      let firstIndex = 1;
      while (firstIndex < southLayer.length) firstIndex <<= 1;
      let treeSize = 2 * firstIndex - 1;
      firstIndex -= 1;
      let tree = new Array(treeSize).fill(0);
      let cc = 0;
      southEntries.forEach((entry) => {
        let index = entry.pos + firstIndex;
        tree[index] += entry.weight;
        let weightSum = 0;
        while (index > 0) {
          if (index % 2) {
            weightSum += tree[index + 1];
          }
          index = index - 1 >> 1;
          tree[index] += entry.weight;
        }
        cc += entry.weight * weightSum;
      });
      return cc;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/order/barycenter.js
var require_barycenter = __commonJS({
  "node_modules/@dagrejs/dagre/lib/order/barycenter.js"(exports2, module2) {
    module2.exports = barycenter;
    function barycenter(g, movable = []) {
      return movable.map((v) => {
        let inV = g.inEdges(v);
        if (!inV.length) {
          return { v };
        } else {
          let result = inV.reduce((acc, e) => {
            let edge = g.edge(e), nodeU = g.node(e.v);
            return {
              sum: acc.sum + edge.weight * nodeU.order,
              weight: acc.weight + edge.weight
            };
          }, { sum: 0, weight: 0 });
          return {
            v,
            barycenter: result.sum / result.weight,
            weight: result.weight
          };
        }
      });
    }
  }
});

// node_modules/@dagrejs/dagre/lib/order/resolve-conflicts.js
var require_resolve_conflicts = __commonJS({
  "node_modules/@dagrejs/dagre/lib/order/resolve-conflicts.js"(exports2, module2) {
    "use strict";
    var util = require_util();
    module2.exports = resolveConflicts;
    function resolveConflicts(entries, cg) {
      let mappedEntries = {};
      entries.forEach((entry, i) => {
        let tmp = mappedEntries[entry.v] = {
          indegree: 0,
          "in": [],
          out: [],
          vs: [entry.v],
          i
        };
        if (entry.barycenter !== void 0) {
          tmp.barycenter = entry.barycenter;
          tmp.weight = entry.weight;
        }
      });
      cg.edges().forEach((e) => {
        let entryV = mappedEntries[e.v];
        let entryW = mappedEntries[e.w];
        if (entryV !== void 0 && entryW !== void 0) {
          entryW.indegree++;
          entryV.out.push(mappedEntries[e.w]);
        }
      });
      let sourceSet = Object.values(mappedEntries).filter((entry) => !entry.indegree);
      return doResolveConflicts(sourceSet);
    }
    function doResolveConflicts(sourceSet) {
      let entries = [];
      function handleIn(vEntry) {
        return (uEntry) => {
          if (uEntry.merged) {
            return;
          }
          if (uEntry.barycenter === void 0 || vEntry.barycenter === void 0 || uEntry.barycenter >= vEntry.barycenter) {
            mergeEntries(vEntry, uEntry);
          }
        };
      }
      function handleOut(vEntry) {
        return (wEntry) => {
          wEntry["in"].push(vEntry);
          if (--wEntry.indegree === 0) {
            sourceSet.push(wEntry);
          }
        };
      }
      while (sourceSet.length) {
        let entry = sourceSet.pop();
        entries.push(entry);
        entry["in"].reverse().forEach(handleIn(entry));
        entry.out.forEach(handleOut(entry));
      }
      return entries.filter((entry) => !entry.merged).map((entry) => {
        return util.pick(entry, ["vs", "i", "barycenter", "weight"]);
      });
    }
    function mergeEntries(target, source) {
      let sum = 0;
      let weight = 0;
      if (target.weight) {
        sum += target.barycenter * target.weight;
        weight += target.weight;
      }
      if (source.weight) {
        sum += source.barycenter * source.weight;
        weight += source.weight;
      }
      target.vs = source.vs.concat(target.vs);
      target.barycenter = sum / weight;
      target.weight = weight;
      target.i = Math.min(source.i, target.i);
      source.merged = true;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/order/sort.js
var require_sort = __commonJS({
  "node_modules/@dagrejs/dagre/lib/order/sort.js"(exports2, module2) {
    var util = require_util();
    module2.exports = sort;
    function sort(entries, biasRight) {
      let parts = util.partition(entries, (entry) => {
        return Object.hasOwn(entry, "barycenter");
      });
      let sortable = parts.lhs, unsortable = parts.rhs.sort((a, b) => b.i - a.i), vs = [], sum = 0, weight = 0, vsIndex = 0;
      sortable.sort(compareWithBias(!!biasRight));
      vsIndex = consumeUnsortable(vs, unsortable, vsIndex);
      sortable.forEach((entry) => {
        vsIndex += entry.vs.length;
        vs.push(entry.vs);
        sum += entry.barycenter * entry.weight;
        weight += entry.weight;
        vsIndex = consumeUnsortable(vs, unsortable, vsIndex);
      });
      let result = { vs: vs.flat(true) };
      if (weight) {
        result.barycenter = sum / weight;
        result.weight = weight;
      }
      return result;
    }
    function consumeUnsortable(vs, unsortable, index) {
      let last;
      while (unsortable.length && (last = unsortable[unsortable.length - 1]).i <= index) {
        unsortable.pop();
        vs.push(last.vs);
        index++;
      }
      return index;
    }
    function compareWithBias(bias) {
      return (entryV, entryW) => {
        if (entryV.barycenter < entryW.barycenter) {
          return -1;
        } else if (entryV.barycenter > entryW.barycenter) {
          return 1;
        }
        return !bias ? entryV.i - entryW.i : entryW.i - entryV.i;
      };
    }
  }
});

// node_modules/@dagrejs/dagre/lib/order/sort-subgraph.js
var require_sort_subgraph = __commonJS({
  "node_modules/@dagrejs/dagre/lib/order/sort-subgraph.js"(exports2, module2) {
    var barycenter = require_barycenter();
    var resolveConflicts = require_resolve_conflicts();
    var sort = require_sort();
    module2.exports = sortSubgraph;
    function sortSubgraph(g, v, cg, biasRight) {
      let movable = g.children(v);
      let node = g.node(v);
      let bl = node ? node.borderLeft : void 0;
      let br = node ? node.borderRight : void 0;
      let subgraphs = {};
      if (bl) {
        movable = movable.filter((w) => w !== bl && w !== br);
      }
      let barycenters = barycenter(g, movable);
      barycenters.forEach((entry) => {
        if (g.children(entry.v).length) {
          let subgraphResult = sortSubgraph(g, entry.v, cg, biasRight);
          subgraphs[entry.v] = subgraphResult;
          if (Object.hasOwn(subgraphResult, "barycenter")) {
            mergeBarycenters(entry, subgraphResult);
          }
        }
      });
      let entries = resolveConflicts(barycenters, cg);
      expandSubgraphs(entries, subgraphs);
      let result = sort(entries, biasRight);
      if (bl) {
        result.vs = [bl, result.vs, br].flat(true);
        if (g.predecessors(bl).length) {
          let blPred = g.node(g.predecessors(bl)[0]), brPred = g.node(g.predecessors(br)[0]);
          if (!Object.hasOwn(result, "barycenter")) {
            result.barycenter = 0;
            result.weight = 0;
          }
          result.barycenter = (result.barycenter * result.weight + blPred.order + brPred.order) / (result.weight + 2);
          result.weight += 2;
        }
      }
      return result;
    }
    function expandSubgraphs(entries, subgraphs) {
      entries.forEach((entry) => {
        entry.vs = entry.vs.flatMap((v) => {
          if (subgraphs[v]) {
            return subgraphs[v].vs;
          }
          return v;
        });
      });
    }
    function mergeBarycenters(target, other) {
      if (target.barycenter !== void 0) {
        target.barycenter = (target.barycenter * target.weight + other.barycenter * other.weight) / (target.weight + other.weight);
        target.weight += other.weight;
      } else {
        target.barycenter = other.barycenter;
        target.weight = other.weight;
      }
    }
  }
});

// node_modules/@dagrejs/dagre/lib/order/build-layer-graph.js
var require_build_layer_graph = __commonJS({
  "node_modules/@dagrejs/dagre/lib/order/build-layer-graph.js"(exports2, module2) {
    var Graph = require_graphlib().Graph;
    var util = require_util();
    module2.exports = buildLayerGraph;
    function buildLayerGraph(g, rank, relationship, nodesWithRank) {
      if (!nodesWithRank) {
        nodesWithRank = g.nodes();
      }
      let root = createRootNode(g), result = new Graph({ compound: true }).setGraph({ root }).setDefaultNodeLabel((v) => g.node(v));
      nodesWithRank.forEach((v) => {
        let node = g.node(v), parent = g.parent(v);
        if (node.rank === rank || node.minRank <= rank && rank <= node.maxRank) {
          result.setNode(v);
          result.setParent(v, parent || root);
          g[relationship](v).forEach((e) => {
            let u = e.v === v ? e.w : e.v, edge = result.edge(u, v), weight = edge !== void 0 ? edge.weight : 0;
            result.setEdge(u, v, { weight: g.edge(e).weight + weight });
          });
          if (Object.hasOwn(node, "minRank")) {
            result.setNode(v, {
              borderLeft: node.borderLeft[rank],
              borderRight: node.borderRight[rank]
            });
          }
        }
      });
      return result;
    }
    function createRootNode(g) {
      var v;
      while (g.hasNode(v = util.uniqueId("_root"))) ;
      return v;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/order/add-subgraph-constraints.js
var require_add_subgraph_constraints = __commonJS({
  "node_modules/@dagrejs/dagre/lib/order/add-subgraph-constraints.js"(exports2, module2) {
    module2.exports = addSubgraphConstraints;
    function addSubgraphConstraints(g, cg, vs) {
      let prev = {}, rootPrev;
      vs.forEach((v) => {
        let child = g.parent(v), parent, prevChild;
        while (child) {
          parent = g.parent(child);
          if (parent) {
            prevChild = prev[parent];
            prev[parent] = child;
          } else {
            prevChild = rootPrev;
            rootPrev = child;
          }
          if (prevChild && prevChild !== child) {
            cg.setEdge(prevChild, child);
            return;
          }
          child = parent;
        }
      });
    }
  }
});

// node_modules/@dagrejs/dagre/lib/order/index.js
var require_order = __commonJS({
  "node_modules/@dagrejs/dagre/lib/order/index.js"(exports2, module2) {
    "use strict";
    var initOrder = require_init_order();
    var crossCount = require_cross_count();
    var sortSubgraph = require_sort_subgraph();
    var buildLayerGraph = require_build_layer_graph();
    var addSubgraphConstraints = require_add_subgraph_constraints();
    var Graph = require_graphlib().Graph;
    var util = require_util();
    module2.exports = order;
    function order(g, opts) {
      if (opts && typeof opts.customOrder === "function") {
        opts.customOrder(g, order);
        return;
      }
      let maxRank = util.maxRank(g), downLayerGraphs = buildLayerGraphs(g, util.range(1, maxRank + 1), "inEdges"), upLayerGraphs = buildLayerGraphs(g, util.range(maxRank - 1, -1, -1), "outEdges");
      let layering = initOrder(g);
      assignOrder(g, layering);
      if (opts && opts.disableOptimalOrderHeuristic) {
        return;
      }
      let bestCC = Number.POSITIVE_INFINITY, best;
      for (let i = 0, lastBest = 0; lastBest < 4; ++i, ++lastBest) {
        sweepLayerGraphs(i % 2 ? downLayerGraphs : upLayerGraphs, i % 4 >= 2);
        layering = util.buildLayerMatrix(g);
        let cc = crossCount(g, layering);
        if (cc < bestCC) {
          lastBest = 0;
          best = Object.assign({}, layering);
          bestCC = cc;
        }
      }
      assignOrder(g, best);
    }
    function buildLayerGraphs(g, ranks, relationship) {
      const nodesByRank = /* @__PURE__ */ new Map();
      const addNodeToRank = (rank, node) => {
        if (!nodesByRank.has(rank)) {
          nodesByRank.set(rank, []);
        }
        nodesByRank.get(rank).push(node);
      };
      for (const v of g.nodes()) {
        const node = g.node(v);
        if (typeof node.rank === "number") {
          addNodeToRank(node.rank, v);
        }
        if (typeof node.minRank === "number" && typeof node.maxRank === "number") {
          for (let r = node.minRank; r <= node.maxRank; r++) {
            if (r !== node.rank) {
              addNodeToRank(r, v);
            }
          }
        }
      }
      return ranks.map(function(rank) {
        return buildLayerGraph(g, rank, relationship, nodesByRank.get(rank) || []);
      });
    }
    function sweepLayerGraphs(layerGraphs, biasRight) {
      let cg = new Graph();
      layerGraphs.forEach(function(lg) {
        let root = lg.graph().root;
        let sorted = sortSubgraph(lg, root, cg, biasRight);
        sorted.vs.forEach((v, i) => lg.node(v).order = i);
        addSubgraphConstraints(lg, cg, sorted.vs);
      });
    }
    function assignOrder(g, layering) {
      Object.values(layering).forEach((layer) => layer.forEach((v, i) => g.node(v).order = i));
    }
  }
});

// node_modules/@dagrejs/dagre/lib/position/bk.js
var require_bk = __commonJS({
  "node_modules/@dagrejs/dagre/lib/position/bk.js"(exports2, module2) {
    "use strict";
    var Graph = require_graphlib().Graph;
    var util = require_util();
    module2.exports = {
      positionX,
      findType1Conflicts,
      findType2Conflicts,
      addConflict,
      hasConflict,
      verticalAlignment,
      horizontalCompaction,
      alignCoordinates,
      findSmallestWidthAlignment,
      balance
    };
    function findType1Conflicts(g, layering) {
      let conflicts = {};
      function visitLayer(prevLayer, layer) {
        let k0 = 0, scanPos = 0, prevLayerLength = prevLayer.length, lastNode = layer[layer.length - 1];
        layer.forEach((v, i) => {
          let w = findOtherInnerSegmentNode(g, v), k1 = w ? g.node(w).order : prevLayerLength;
          if (w || v === lastNode) {
            layer.slice(scanPos, i + 1).forEach((scanNode) => {
              g.predecessors(scanNode).forEach((u) => {
                let uLabel = g.node(u), uPos = uLabel.order;
                if ((uPos < k0 || k1 < uPos) && !(uLabel.dummy && g.node(scanNode).dummy)) {
                  addConflict(conflicts, u, scanNode);
                }
              });
            });
            scanPos = i + 1;
            k0 = k1;
          }
        });
        return layer;
      }
      layering.length && layering.reduce(visitLayer);
      return conflicts;
    }
    function findType2Conflicts(g, layering) {
      let conflicts = {};
      function scan(south, southPos, southEnd, prevNorthBorder, nextNorthBorder) {
        let v;
        util.range(southPos, southEnd).forEach((i) => {
          v = south[i];
          if (g.node(v).dummy) {
            g.predecessors(v).forEach((u) => {
              let uNode = g.node(u);
              if (uNode.dummy && (uNode.order < prevNorthBorder || uNode.order > nextNorthBorder)) {
                addConflict(conflicts, u, v);
              }
            });
          }
        });
      }
      function visitLayer(north, south) {
        let prevNorthPos = -1, nextNorthPos, southPos = 0;
        south.forEach((v, southLookahead) => {
          if (g.node(v).dummy === "border") {
            let predecessors = g.predecessors(v);
            if (predecessors.length) {
              nextNorthPos = g.node(predecessors[0]).order;
              scan(south, southPos, southLookahead, prevNorthPos, nextNorthPos);
              southPos = southLookahead;
              prevNorthPos = nextNorthPos;
            }
          }
          scan(south, southPos, south.length, nextNorthPos, north.length);
        });
        return south;
      }
      layering.length && layering.reduce(visitLayer);
      return conflicts;
    }
    function findOtherInnerSegmentNode(g, v) {
      if (g.node(v).dummy) {
        return g.predecessors(v).find((u) => g.node(u).dummy);
      }
    }
    function addConflict(conflicts, v, w) {
      if (v > w) {
        let tmp = v;
        v = w;
        w = tmp;
      }
      let conflictsV = conflicts[v];
      if (!conflictsV) {
        conflicts[v] = conflictsV = {};
      }
      conflictsV[w] = true;
    }
    function hasConflict(conflicts, v, w) {
      if (v > w) {
        let tmp = v;
        v = w;
        w = tmp;
      }
      return !!conflicts[v] && Object.hasOwn(conflicts[v], w);
    }
    function verticalAlignment(g, layering, conflicts, neighborFn) {
      let root = {}, align = {}, pos = {};
      layering.forEach((layer) => {
        layer.forEach((v, order) => {
          root[v] = v;
          align[v] = v;
          pos[v] = order;
        });
      });
      layering.forEach((layer) => {
        let prevIdx = -1;
        layer.forEach((v) => {
          let ws = neighborFn(v);
          if (ws.length) {
            ws = ws.sort((a, b) => pos[a] - pos[b]);
            let mp = (ws.length - 1) / 2;
            for (let i = Math.floor(mp), il = Math.ceil(mp); i <= il; ++i) {
              let w = ws[i];
              if (align[v] === v && prevIdx < pos[w] && !hasConflict(conflicts, v, w)) {
                align[w] = v;
                align[v] = root[v] = root[w];
                prevIdx = pos[w];
              }
            }
          }
        });
      });
      return { root, align };
    }
    function horizontalCompaction(g, layering, root, align, reverseSep) {
      let xs = {}, blockG = buildBlockGraph(g, layering, root, reverseSep), borderType = reverseSep ? "borderLeft" : "borderRight";
      function iterate(setXsFunc, nextNodesFunc) {
        let stack = blockG.nodes();
        let elem = stack.pop();
        let visited = {};
        while (elem) {
          if (visited[elem]) {
            setXsFunc(elem);
          } else {
            visited[elem] = true;
            stack.push(elem);
            stack = stack.concat(nextNodesFunc(elem));
          }
          elem = stack.pop();
        }
      }
      function pass1(elem) {
        xs[elem] = blockG.inEdges(elem).reduce((acc, e) => {
          return Math.max(acc, xs[e.v] + blockG.edge(e));
        }, 0);
      }
      function pass2(elem) {
        let min = blockG.outEdges(elem).reduce((acc, e) => {
          return Math.min(acc, xs[e.w] - blockG.edge(e));
        }, Number.POSITIVE_INFINITY);
        let node = g.node(elem);
        if (min !== Number.POSITIVE_INFINITY && node.borderType !== borderType) {
          xs[elem] = Math.max(xs[elem], min);
        }
      }
      iterate(pass1, blockG.predecessors.bind(blockG));
      iterate(pass2, blockG.successors.bind(blockG));
      Object.keys(align).forEach((v) => xs[v] = xs[root[v]]);
      return xs;
    }
    function buildBlockGraph(g, layering, root, reverseSep) {
      let blockGraph = new Graph(), graphLabel = g.graph(), sepFn = sep2(graphLabel.nodesep, graphLabel.edgesep, reverseSep);
      layering.forEach((layer) => {
        let u;
        layer.forEach((v) => {
          let vRoot = root[v];
          blockGraph.setNode(vRoot);
          if (u) {
            var uRoot = root[u], prevMax = blockGraph.edge(uRoot, vRoot);
            blockGraph.setEdge(uRoot, vRoot, Math.max(sepFn(g, v, u), prevMax || 0));
          }
          u = v;
        });
      });
      return blockGraph;
    }
    function findSmallestWidthAlignment(g, xss) {
      return Object.values(xss).reduce((currentMinAndXs, xs) => {
        let max = Number.NEGATIVE_INFINITY;
        let min = Number.POSITIVE_INFINITY;
        Object.entries(xs).forEach(([v, x]) => {
          let halfWidth = width(g, v) / 2;
          max = Math.max(x + halfWidth, max);
          min = Math.min(x - halfWidth, min);
        });
        const newMin = max - min;
        if (newMin < currentMinAndXs[0]) {
          currentMinAndXs = [newMin, xs];
        }
        return currentMinAndXs;
      }, [Number.POSITIVE_INFINITY, null])[1];
    }
    function alignCoordinates(xss, alignTo) {
      let alignToVals = Object.values(alignTo), alignToMin = util.applyWithChunking(Math.min, alignToVals), alignToMax = util.applyWithChunking(Math.max, alignToVals);
      ["u", "d"].forEach((vert) => {
        ["l", "r"].forEach((horiz) => {
          let alignment = vert + horiz, xs = xss[alignment];
          if (xs === alignTo) return;
          let xsVals = Object.values(xs);
          let delta = alignToMin - util.applyWithChunking(Math.min, xsVals);
          if (horiz !== "l") {
            delta = alignToMax - util.applyWithChunking(Math.max, xsVals);
          }
          if (delta) {
            xss[alignment] = util.mapValues(xs, (x) => x + delta);
          }
        });
      });
    }
    function balance(xss, align) {
      return util.mapValues(xss.ul, (num, v) => {
        if (align) {
          return xss[align.toLowerCase()][v];
        } else {
          let xs = Object.values(xss).map((xs2) => xs2[v]).sort((a, b) => a - b);
          return (xs[1] + xs[2]) / 2;
        }
      });
    }
    function positionX(g) {
      let layering = util.buildLayerMatrix(g);
      let conflicts = Object.assign(
        findType1Conflicts(g, layering),
        findType2Conflicts(g, layering)
      );
      let xss = {};
      let adjustedLayering;
      ["u", "d"].forEach((vert) => {
        adjustedLayering = vert === "u" ? layering : Object.values(layering).reverse();
        ["l", "r"].forEach((horiz) => {
          if (horiz === "r") {
            adjustedLayering = adjustedLayering.map((inner) => {
              return Object.values(inner).reverse();
            });
          }
          let neighborFn = (vert === "u" ? g.predecessors : g.successors).bind(g);
          let align = verticalAlignment(g, adjustedLayering, conflicts, neighborFn);
          let xs = horizontalCompaction(
            g,
            adjustedLayering,
            align.root,
            align.align,
            horiz === "r"
          );
          if (horiz === "r") {
            xs = util.mapValues(xs, (x) => -x);
          }
          xss[vert + horiz] = xs;
        });
      });
      let smallestWidth = findSmallestWidthAlignment(g, xss);
      alignCoordinates(xss, smallestWidth);
      return balance(xss, g.graph().align);
    }
    function sep2(nodeSep, edgeSep, reverseSep) {
      return (g, v, w) => {
        let vLabel = g.node(v);
        let wLabel = g.node(w);
        let sum = 0;
        let delta;
        sum += vLabel.width / 2;
        if (Object.hasOwn(vLabel, "labelpos")) {
          switch (vLabel.labelpos.toLowerCase()) {
            case "l":
              delta = -vLabel.width / 2;
              break;
            case "r":
              delta = vLabel.width / 2;
              break;
          }
        }
        if (delta) {
          sum += reverseSep ? delta : -delta;
        }
        delta = 0;
        sum += (vLabel.dummy ? edgeSep : nodeSep) / 2;
        sum += (wLabel.dummy ? edgeSep : nodeSep) / 2;
        sum += wLabel.width / 2;
        if (Object.hasOwn(wLabel, "labelpos")) {
          switch (wLabel.labelpos.toLowerCase()) {
            case "l":
              delta = wLabel.width / 2;
              break;
            case "r":
              delta = -wLabel.width / 2;
              break;
          }
        }
        if (delta) {
          sum += reverseSep ? delta : -delta;
        }
        delta = 0;
        return sum;
      };
    }
    function width(g, v) {
      return g.node(v).width;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/position/index.js
var require_position = __commonJS({
  "node_modules/@dagrejs/dagre/lib/position/index.js"(exports2, module2) {
    "use strict";
    var util = require_util();
    var positionX = require_bk().positionX;
    module2.exports = position;
    function position(g) {
      g = util.asNonCompoundGraph(g);
      positionY(g);
      Object.entries(positionX(g)).forEach(([v, x]) => g.node(v).x = x);
    }
    function positionY(g) {
      let layering = util.buildLayerMatrix(g);
      let rankSep = g.graph().ranksep;
      let prevY = 0;
      layering.forEach((layer) => {
        const maxHeight = layer.reduce((acc, v) => {
          const height = g.node(v).height;
          if (acc > height) {
            return acc;
          } else {
            return height;
          }
        }, 0);
        layer.forEach((v) => g.node(v).y = prevY + maxHeight / 2);
        prevY += maxHeight + rankSep;
      });
    }
  }
});

// node_modules/@dagrejs/dagre/lib/layout.js
var require_layout = __commonJS({
  "node_modules/@dagrejs/dagre/lib/layout.js"(exports2, module2) {
    "use strict";
    var acyclic = require_acyclic();
    var normalize = require_normalize();
    var rank = require_rank();
    var normalizeRanks = require_util().normalizeRanks;
    var parentDummyChains = require_parent_dummy_chains();
    var removeEmptyRanks = require_util().removeEmptyRanks;
    var nestingGraph = require_nesting_graph();
    var addBorderSegments = require_add_border_segments();
    var coordinateSystem = require_coordinate_system();
    var order = require_order();
    var position = require_position();
    var util = require_util();
    var Graph = require_graphlib().Graph;
    module2.exports = layout;
    function layout(g, opts) {
      let time = opts && opts.debugTiming ? util.time : util.notime;
      time("layout", () => {
        let layoutGraph = time("  buildLayoutGraph", () => buildLayoutGraph(g));
        time("  runLayout", () => runLayout(layoutGraph, time, opts));
        time("  updateInputGraph", () => updateInputGraph(g, layoutGraph));
      });
    }
    function runLayout(g, time, opts) {
      time("    makeSpaceForEdgeLabels", () => makeSpaceForEdgeLabels(g));
      time("    removeSelfEdges", () => removeSelfEdges(g));
      time("    acyclic", () => acyclic.run(g));
      time("    nestingGraph.run", () => nestingGraph.run(g));
      time("    rank", () => rank(util.asNonCompoundGraph(g)));
      time("    injectEdgeLabelProxies", () => injectEdgeLabelProxies(g));
      time("    removeEmptyRanks", () => removeEmptyRanks(g));
      time("    nestingGraph.cleanup", () => nestingGraph.cleanup(g));
      time("    normalizeRanks", () => normalizeRanks(g));
      time("    assignRankMinMax", () => assignRankMinMax(g));
      time("    removeEdgeLabelProxies", () => removeEdgeLabelProxies(g));
      time("    normalize.run", () => normalize.run(g));
      time("    parentDummyChains", () => parentDummyChains(g));
      time("    addBorderSegments", () => addBorderSegments(g));
      time("    order", () => order(g, opts));
      time("    insertSelfEdges", () => insertSelfEdges(g));
      time("    adjustCoordinateSystem", () => coordinateSystem.adjust(g));
      time("    position", () => position(g));
      time("    positionSelfEdges", () => positionSelfEdges(g));
      time("    removeBorderNodes", () => removeBorderNodes(g));
      time("    normalize.undo", () => normalize.undo(g));
      time("    fixupEdgeLabelCoords", () => fixupEdgeLabelCoords(g));
      time("    undoCoordinateSystem", () => coordinateSystem.undo(g));
      time("    translateGraph", () => translateGraph(g));
      time("    assignNodeIntersects", () => assignNodeIntersects(g));
      time("    reversePoints", () => reversePointsForReversedEdges(g));
      time("    acyclic.undo", () => acyclic.undo(g));
    }
    function updateInputGraph(inputGraph, layoutGraph) {
      inputGraph.nodes().forEach((v) => {
        let inputLabel = inputGraph.node(v);
        let layoutLabel = layoutGraph.node(v);
        if (inputLabel) {
          inputLabel.x = layoutLabel.x;
          inputLabel.y = layoutLabel.y;
          inputLabel.rank = layoutLabel.rank;
          if (layoutGraph.children(v).length) {
            inputLabel.width = layoutLabel.width;
            inputLabel.height = layoutLabel.height;
          }
        }
      });
      inputGraph.edges().forEach((e) => {
        let inputLabel = inputGraph.edge(e);
        let layoutLabel = layoutGraph.edge(e);
        inputLabel.points = layoutLabel.points;
        if (Object.hasOwn(layoutLabel, "x")) {
          inputLabel.x = layoutLabel.x;
          inputLabel.y = layoutLabel.y;
        }
      });
      inputGraph.graph().width = layoutGraph.graph().width;
      inputGraph.graph().height = layoutGraph.graph().height;
    }
    var graphNumAttrs = ["nodesep", "edgesep", "ranksep", "marginx", "marginy"];
    var graphDefaults = { ranksep: 50, edgesep: 20, nodesep: 50, rankdir: "tb" };
    var graphAttrs = ["acyclicer", "ranker", "rankdir", "align"];
    var nodeNumAttrs = ["width", "height", "rank"];
    var nodeDefaults = { width: 0, height: 0 };
    var edgeNumAttrs = ["minlen", "weight", "width", "height", "labeloffset"];
    var edgeDefaults = {
      minlen: 1,
      weight: 1,
      width: 0,
      height: 0,
      labeloffset: 10,
      labelpos: "r"
    };
    var edgeAttrs = ["labelpos"];
    function buildLayoutGraph(inputGraph) {
      let g = new Graph({ multigraph: true, compound: true });
      let graph = canonicalize(inputGraph.graph());
      g.setGraph(Object.assign(
        {},
        graphDefaults,
        selectNumberAttrs(graph, graphNumAttrs),
        util.pick(graph, graphAttrs)
      ));
      inputGraph.nodes().forEach((v) => {
        let node = canonicalize(inputGraph.node(v));
        const newNode = selectNumberAttrs(node, nodeNumAttrs);
        Object.keys(nodeDefaults).forEach((k) => {
          if (newNode[k] === void 0) {
            newNode[k] = nodeDefaults[k];
          }
        });
        g.setNode(v, newNode);
        g.setParent(v, inputGraph.parent(v));
      });
      inputGraph.edges().forEach((e) => {
        let edge = canonicalize(inputGraph.edge(e));
        g.setEdge(e, Object.assign(
          {},
          edgeDefaults,
          selectNumberAttrs(edge, edgeNumAttrs),
          util.pick(edge, edgeAttrs)
        ));
      });
      return g;
    }
    function makeSpaceForEdgeLabels(g) {
      let graph = g.graph();
      graph.ranksep /= 2;
      g.edges().forEach((e) => {
        let edge = g.edge(e);
        edge.minlen *= 2;
        if (edge.labelpos.toLowerCase() !== "c") {
          if (graph.rankdir === "TB" || graph.rankdir === "BT") {
            edge.width += edge.labeloffset;
          } else {
            edge.height += edge.labeloffset;
          }
        }
      });
    }
    function injectEdgeLabelProxies(g) {
      g.edges().forEach((e) => {
        let edge = g.edge(e);
        if (edge.width && edge.height) {
          let v = g.node(e.v);
          let w = g.node(e.w);
          let label = { rank: (w.rank - v.rank) / 2 + v.rank, e };
          util.addDummyNode(g, "edge-proxy", label, "_ep");
        }
      });
    }
    function assignRankMinMax(g) {
      let maxRank = 0;
      g.nodes().forEach((v) => {
        let node = g.node(v);
        if (node.borderTop) {
          node.minRank = g.node(node.borderTop).rank;
          node.maxRank = g.node(node.borderBottom).rank;
          maxRank = Math.max(maxRank, node.maxRank);
        }
      });
      g.graph().maxRank = maxRank;
    }
    function removeEdgeLabelProxies(g) {
      g.nodes().forEach((v) => {
        let node = g.node(v);
        if (node.dummy === "edge-proxy") {
          g.edge(node.e).labelRank = node.rank;
          g.removeNode(v);
        }
      });
    }
    function translateGraph(g) {
      let minX = Number.POSITIVE_INFINITY;
      let maxX = 0;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = 0;
      let graphLabel = g.graph();
      let marginX = graphLabel.marginx || 0;
      let marginY = graphLabel.marginy || 0;
      function getExtremes(attrs) {
        let x = attrs.x;
        let y = attrs.y;
        let w = attrs.width;
        let h = attrs.height;
        minX = Math.min(minX, x - w / 2);
        maxX = Math.max(maxX, x + w / 2);
        minY = Math.min(minY, y - h / 2);
        maxY = Math.max(maxY, y + h / 2);
      }
      g.nodes().forEach((v) => getExtremes(g.node(v)));
      g.edges().forEach((e) => {
        let edge = g.edge(e);
        if (Object.hasOwn(edge, "x")) {
          getExtremes(edge);
        }
      });
      minX -= marginX;
      minY -= marginY;
      g.nodes().forEach((v) => {
        let node = g.node(v);
        node.x -= minX;
        node.y -= minY;
      });
      g.edges().forEach((e) => {
        let edge = g.edge(e);
        edge.points.forEach((p) => {
          p.x -= minX;
          p.y -= minY;
        });
        if (Object.hasOwn(edge, "x")) {
          edge.x -= minX;
        }
        if (Object.hasOwn(edge, "y")) {
          edge.y -= minY;
        }
      });
      graphLabel.width = maxX - minX + marginX;
      graphLabel.height = maxY - minY + marginY;
    }
    function assignNodeIntersects(g) {
      g.edges().forEach((e) => {
        let edge = g.edge(e);
        let nodeV = g.node(e.v);
        let nodeW = g.node(e.w);
        let p1, p2;
        if (!edge.points) {
          edge.points = [];
          p1 = nodeW;
          p2 = nodeV;
        } else {
          p1 = edge.points[0];
          p2 = edge.points[edge.points.length - 1];
        }
        edge.points.unshift(util.intersectRect(nodeV, p1));
        edge.points.push(util.intersectRect(nodeW, p2));
      });
    }
    function fixupEdgeLabelCoords(g) {
      g.edges().forEach((e) => {
        let edge = g.edge(e);
        if (Object.hasOwn(edge, "x")) {
          if (edge.labelpos === "l" || edge.labelpos === "r") {
            edge.width -= edge.labeloffset;
          }
          switch (edge.labelpos) {
            case "l":
              edge.x -= edge.width / 2 + edge.labeloffset;
              break;
            case "r":
              edge.x += edge.width / 2 + edge.labeloffset;
              break;
          }
        }
      });
    }
    function reversePointsForReversedEdges(g) {
      g.edges().forEach((e) => {
        let edge = g.edge(e);
        if (edge.reversed) {
          edge.points.reverse();
        }
      });
    }
    function removeBorderNodes(g) {
      g.nodes().forEach((v) => {
        if (g.children(v).length) {
          let node = g.node(v);
          let t = g.node(node.borderTop);
          let b = g.node(node.borderBottom);
          let l = g.node(node.borderLeft[node.borderLeft.length - 1]);
          let r = g.node(node.borderRight[node.borderRight.length - 1]);
          node.width = Math.abs(r.x - l.x);
          node.height = Math.abs(b.y - t.y);
          node.x = l.x + node.width / 2;
          node.y = t.y + node.height / 2;
        }
      });
      g.nodes().forEach((v) => {
        if (g.node(v).dummy === "border") {
          g.removeNode(v);
        }
      });
    }
    function removeSelfEdges(g) {
      g.edges().forEach((e) => {
        if (e.v === e.w) {
          var node = g.node(e.v);
          if (!node.selfEdges) {
            node.selfEdges = [];
          }
          node.selfEdges.push({ e, label: g.edge(e) });
          g.removeEdge(e);
        }
      });
    }
    function insertSelfEdges(g) {
      var layers = util.buildLayerMatrix(g);
      layers.forEach((layer) => {
        var orderShift = 0;
        layer.forEach((v, i) => {
          var node = g.node(v);
          node.order = i + orderShift;
          (node.selfEdges || []).forEach((selfEdge) => {
            util.addDummyNode(g, "selfedge", {
              width: selfEdge.label.width,
              height: selfEdge.label.height,
              rank: node.rank,
              order: i + ++orderShift,
              e: selfEdge.e,
              label: selfEdge.label
            }, "_se");
          });
          delete node.selfEdges;
        });
      });
    }
    function positionSelfEdges(g) {
      g.nodes().forEach((v) => {
        var node = g.node(v);
        if (node.dummy === "selfedge") {
          var selfNode = g.node(node.e.v);
          var x = selfNode.x + selfNode.width / 2;
          var y = selfNode.y;
          var dx = node.x - x;
          var dy = selfNode.height / 2;
          g.setEdge(node.e, node.label);
          g.removeNode(v);
          node.label.points = [
            { x: x + 2 * dx / 3, y: y - dy },
            { x: x + 5 * dx / 6, y: y - dy },
            { x: x + dx, y },
            { x: x + 5 * dx / 6, y: y + dy },
            { x: x + 2 * dx / 3, y: y + dy }
          ];
          node.label.x = node.x;
          node.label.y = node.y;
        }
      });
    }
    function selectNumberAttrs(obj, attrs) {
      return util.mapValues(util.pick(obj, attrs), Number);
    }
    function canonicalize(attrs) {
      var newAttrs = {};
      if (attrs) {
        Object.entries(attrs).forEach(([k, v]) => {
          if (typeof k === "string") {
            k = k.toLowerCase();
          }
          newAttrs[k] = v;
        });
      }
      return newAttrs;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/debug.js
var require_debug = __commonJS({
  "node_modules/@dagrejs/dagre/lib/debug.js"(exports2, module2) {
    var util = require_util();
    var Graph = require_graphlib().Graph;
    module2.exports = {
      debugOrdering
    };
    function debugOrdering(g) {
      let layerMatrix = util.buildLayerMatrix(g);
      let h = new Graph({ compound: true, multigraph: true }).setGraph({});
      g.nodes().forEach((v) => {
        h.setNode(v, { label: v });
        h.setParent(v, "layer" + g.node(v).rank);
      });
      g.edges().forEach((e) => h.setEdge(e.v, e.w, {}, e.name));
      layerMatrix.forEach((layer, i) => {
        let layerV = "layer" + i;
        h.setNode(layerV, { rank: "same" });
        layer.reduce((u, v) => {
          h.setEdge(u, v, { style: "invis" });
          return v;
        });
      });
      return h;
    }
  }
});

// node_modules/@dagrejs/dagre/lib/version.js
var require_version2 = __commonJS({
  "node_modules/@dagrejs/dagre/lib/version.js"(exports2, module2) {
    module2.exports = "1.1.8";
  }
});

// node_modules/@dagrejs/dagre/index.js
var require_dagre = __commonJS({
  "node_modules/@dagrejs/dagre/index.js"(exports2, module2) {
    module2.exports = {
      graphlib: require_graphlib(),
      layout: require_layout(),
      debug: require_debug(),
      util: {
        time: require_util().time,
        notime: require_util().notime
      },
      version: require_version2()
    };
  }
});

// node_modules/content-type/dist/index.js
var require_dist = __commonJS({
  "node_modules/content-type/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.format = format;
    exports2.parse = parse3;
    var TEXT_REGEXP = /^[\u0009\u0020-\u007e\u0080-\u00ff]*$/;
    var TOKEN_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
    var QUOTE_REGEXP = /[\\"]/g;
    var TYPE_REGEXP = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+\/[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
    var NullObject = /* @__PURE__ */ (() => {
      const C = function() {
      };
      C.prototype = /* @__PURE__ */ Object.create(null);
      return C;
    })();
    function format(obj) {
      const { type, parameters } = obj;
      if (!type || !TYPE_REGEXP.test(type)) {
        throw new TypeError(`Invalid type: ${type}`);
      }
      let result = type;
      if (parameters) {
        for (const param of Object.keys(parameters)) {
          if (!TOKEN_REGEXP.test(param)) {
            throw new TypeError(`Invalid parameter name: ${param}`);
          }
          result += `; ${param}=${qstring(parameters[param])}`;
        }
      }
      return result;
    }
    function parse3(header, options) {
      const len = header.length;
      let index = skipOWS(header, 0, len);
      const valueStart = index;
      index = skipValue(header, index, len);
      const valueEnd = trailingOWS(header, valueStart, index);
      const type = header.slice(valueStart, valueEnd).toLowerCase();
      const parameters = options?.parameters === false ? new NullObject() : parseParameters(header, index, len);
      return { type, parameters };
    }
    var SP = 32;
    var HTAB = 9;
    var SEMI = 59;
    var EQ = 61;
    var DQUOTE = 34;
    var BSLASH = 92;
    function parseParameters(header, index, len) {
      const parameters = new NullObject();
      parameter: while (index < len) {
        index = skipOWS(header, index + 1, len);
        const keyStart = index;
        while (index < len) {
          const code = header.charCodeAt(index);
          if (code === SEMI)
            continue parameter;
          if (code === EQ) {
            const keyEnd = trailingOWS(header, keyStart, index);
            const key = header.slice(keyStart, keyEnd).toLowerCase();
            index = skipOWS(header, index + 1, len);
            if (index < len && header.charCodeAt(index) === DQUOTE) {
              index++;
              let value = "";
              while (index < len) {
                const code2 = header.charCodeAt(index++);
                if (code2 === DQUOTE) {
                  index = skipValue(header, index, len);
                  if (parameters[key] === void 0)
                    parameters[key] = value;
                  break;
                }
                if (code2 === BSLASH && index < len) {
                  value += header[index++];
                  continue;
                }
                value += String.fromCharCode(code2);
              }
              continue parameter;
            }
            const valueStart = index;
            index = skipValue(header, index, len);
            if (parameters[key] === void 0) {
              const valueEnd = trailingOWS(header, valueStart, index);
              parameters[key] = header.slice(valueStart, valueEnd);
            }
            continue parameter;
          }
          index++;
        }
      }
      return parameters;
    }
    function skipValue(str, index, len) {
      while (index < len) {
        const char = str.charCodeAt(index);
        if (char === SEMI)
          break;
        index++;
      }
      return index;
    }
    function skipOWS(header, index, len) {
      while (index < len) {
        const char = header.charCodeAt(index);
        if (char !== SP && char !== HTAB)
          break;
        index++;
      }
      return index;
    }
    function trailingOWS(header, start, end) {
      while (end > start) {
        const char = header.charCodeAt(end - 1);
        if (char !== SP && char !== HTAB)
          break;
        end--;
      }
      return end;
    }
    function qstring(str) {
      if (TOKEN_REGEXP.test(str))
        return str;
      if (TEXT_REGEXP.test(str))
        return `"${str.replace(QUOTE_REGEXP, "\\$&")}"`;
      throw new TypeError(`Invalid parameter value: ${str}`);
    }
  }
});

// src/action/inputs.ts
function getInput(name) {
  return (process.env[`INPUT_${name.replace(/-/g, "_").toUpperCase()}`] ?? "").trim();
}
function requireInput(name) {
  const value = getInput(name);
  if (!value) {
    console.error(`input "${name}" is required`);
    process.exit(1);
  }
  return value;
}

// src/action/publish.ts
var fs2 = __toESM(require("fs"));
var path = __toESM(require("path"));

// src/action/github.ts
var OctokitGithubClient = class {
  constructor(octokit) {
    this.octokit = octokit;
  }
  async listChangedBtJsonFiles(owner, repo, prNumber) {
    const files = await this.octokit.paginate(
      this.octokit.rest.pulls.listFiles,
      { owner, repo, pull_number: prNumber, per_page: 100 }
    );
    return files.filter((f) => f.filename.endsWith(".bt.json")).map((f) => ({ path: f.filename, status: f.status }));
  }
  async fetchFileAtRef(owner, repo, filePath, ref) {
    let data;
    try {
      ({ data } = await this.octokit.rest.repos.getContent({ owner, repo, path: filePath, ref }));
    } catch (err) {
      if (err.status === 404) return null;
      throw err;
    }
    if (!data || typeof data !== "object" || !("content" in data) || data.type !== "file") {
      throw new Error(`${filePath}@${ref} did not resolve to a single file`);
    }
    return Buffer.from(data.content, "base64").toString("utf8");
  }
  async listIssueComments(owner, repo, issueNumber) {
    const comments = await this.octokit.paginate(
      this.octokit.rest.issues.listComments,
      { owner, repo, issue_number: issueNumber, per_page: 100 }
    );
    return comments.map((c) => ({ id: c.id, body: c.body ?? "" }));
  }
  async createIssueComment(owner, repo, issueNumber, body) {
    await this.octokit.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
  }
  async deleteIssueComment(owner, repo, commentId) {
    await this.octokit.rest.issues.deleteComment({ owner, repo, comment_id: commentId });
  }
};

// shared/btConstants.ts
var BT_PARALLEL_FAILURE_CHILD_ONE = "BT_PARALLEL_FAILURE_CHILD_ONE";
var BT_PARALLEL_FAILURE_ANY = "BT_PARALLEL_FAILURE_ANY";
var BT_PARALLEL_FAILURE_POLICIES = [
  BT_PARALLEL_FAILURE_CHILD_ONE,
  BT_PARALLEL_FAILURE_ANY
];
var BT_PARALLEL_SUCCESS_CHILD_ONE = "BT_PARALLEL_SUCCESS_CHILD_ONE";
var BT_PARALLEL_SUCCESS_ALL = "BT_PARALLEL_SUCCESS_ALL";
var BT_PARALLEL_SUCCESS_POLICIES = [
  BT_PARALLEL_SUCCESS_CHILD_ONE,
  BT_PARALLEL_SUCCESS_ALL
];
var BT_SUBPLAN_SUCCEED_ON_SUCCESS = "BT_SUBPLAN_SUCCEED_ON_SUCCESS";
var BT_SUBPLAN_LOOP_ON_SUCCESS = "BT_SUBPLAN_LOOP_ON_SUCCESS";
var BT_SUBPLAN_SUCCESS_POLICIES = [
  BT_SUBPLAN_SUCCEED_ON_SUCCESS,
  BT_SUBPLAN_LOOP_ON_SUCCESS
];
var BT_SUBPLAN_FAIL_ON_FAILURE = "BT_SUBPLAN_FAIL_ON_FAILURE";
var BT_SUBPLAN_LOOP_ON_FAILURE = "BT_SUBPLAN_LOOP_ON_FAILURE";
var BT_SUBPLAN_FAILURE_POLICIES = [
  BT_SUBPLAN_FAIL_ON_FAILURE,
  BT_SUBPLAN_LOOP_ON_FAILURE
];
var BT_ABORT_NONE = "BT_ABORT_NONE";
var BT_ABORT_SELF = "BT_ABORT_SELF";
var BT_ABORT_LOWER_PRIORITY = "BT_ABORT_LOWER_PRIORITY";
var BT_ABORT_BOTH = "BT_ABORT_BOTH";
var BT_LABELS = {
  [BT_PARALLEL_FAILURE_CHILD_ONE]: "Fail when child 1 fails",
  [BT_PARALLEL_FAILURE_ANY]: "Fail when any child fails",
  [BT_PARALLEL_SUCCESS_CHILD_ONE]: "Succeed when child 1 succeeds",
  [BT_PARALLEL_SUCCESS_ALL]: "Succeed when all children succeed",
  [BT_SUBPLAN_SUCCEED_ON_SUCCESS]: "Succeed on success",
  [BT_SUBPLAN_LOOP_ON_SUCCESS]: "Loop on success",
  [BT_SUBPLAN_FAIL_ON_FAILURE]: "Fail on failure",
  [BT_SUBPLAN_LOOP_ON_FAILURE]: "Loop on failure",
  [BT_ABORT_NONE]: "Do not abort on condition change",
  [BT_ABORT_SELF]: "Abort self on condition change",
  [BT_ABORT_LOWER_PRIORITY]: "Abort lower priority branches on condition change",
  [BT_ABORT_BOTH]: "Abort both self and lower priority branches on condition change"
};

// shared/compositeSchema.ts
var COMPOSITE_SCHEMAS = {
  parallel: [
    {
      type: "enum",
      key: "failurePolicy",
      jsonKey: "failure_policy",
      label: "Failure Policy",
      values: BT_PARALLEL_FAILURE_POLICIES,
      default: BT_PARALLEL_FAILURE_CHILD_ONE
    },
    {
      type: "enum",
      key: "successPolicy",
      jsonKey: "success_policy",
      label: "Success Policy",
      values: BT_PARALLEL_SUCCESS_POLICIES,
      default: BT_PARALLEL_SUCCESS_CHILD_ONE
    },
    {
      type: "boolean",
      key: "repeatSecondary",
      jsonKey: "repeat_secondary",
      label: "Repeat Secondary",
      default: false
    },
    {
      type: "text",
      key: "repeatSecondaryDelay",
      jsonKey: "repeat_secondary_delay",
      label: "Repeat Secondary Delay",
      optional: true,
      placeholder: "default"
    },
    {
      type: "boolean",
      key: "finishOnPrimary",
      jsonKey: "finish_on_primary",
      label: "Finish on Primary",
      default: true
    }
  ],
  subplan: [
    {
      type: "enum",
      key: "successPolicy",
      jsonKey: "success_policy",
      label: "Success Policy",
      values: BT_SUBPLAN_SUCCESS_POLICIES,
      default: BT_SUBPLAN_SUCCEED_ON_SUCCESS
    },
    {
      type: "enum",
      key: "failurePolicy",
      jsonKey: "failure_policy",
      label: "Failure Policy",
      values: BT_SUBPLAN_FAILURE_POLICIES,
      default: BT_SUBPLAN_FAIL_ON_FAILURE
    },
    {
      type: "text",
      key: "loopDelay",
      jsonKey: "loop_delay",
      label: "Loop Delay",
      optional: true,
      placeholder: "default"
    }
  ]
};

// src/parser/btJsonParser.ts
function scalarToString(v) {
  if (v === true) return "TRUE";
  if (v === false) return "FALSE";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  throw new Error(`Unexpected scalar value: ${JSON.stringify(v)}`);
}
function configValueToNode(v) {
  if (Array.isArray(v)) return v.map(scalarToString);
  return scalarToString(v);
}
function parseNode(obj) {
  const type = obj["type"];
  switch (type) {
    case "selector":
    case "sequence": {
      const children = (obj["children"] ?? []).map((c) => parseNode(c));
      return { kind: type, children };
    }
    case "parallel":
    case "subplan": {
      const children = (obj["children"] ?? []).map((c) => parseNode(c));
      const props = {};
      for (const prop of COMPOSITE_SCHEMAS[type] ?? []) {
        const raw = obj[prop.jsonKey];
        if (prop.type === "boolean") {
          props[prop.key] = Boolean(raw ?? prop.default);
        } else if (prop.type === "enum") {
          props[prop.key] = String(raw ?? prop.default);
        } else {
          if (raw != null) props[prop.key] = scalarToString(raw);
        }
      }
      return { kind: type, ...props, children };
    }
    case "decorator": {
      const vars = {};
      const rawVars = obj["vars"] ?? {};
      for (const [k, v] of Object.entries(rawVars)) {
        vars[k] = configValueToNode(v);
      }
      const child = obj["child"] ? parseNode(obj["child"]) : void 0;
      return {
        kind: "decorator",
        nodeType: String(obj["decorator"] ?? ""),
        child,
        vars
      };
    }
    case "leaf": {
      const vars = {};
      const rawVars = obj["vars"];
      if (rawVars && typeof rawVars === "object" && !Array.isArray(rawVars)) {
        for (const [k, v] of Object.entries(rawVars)) {
          vars[k] = configValueToNode(v);
        }
      }
      return {
        kind: "leaf",
        behaviorType: String(obj["behavior"] ?? ""),
        vars
      };
    }
    case "subtree": {
      const subtree = {
        kind: "subtree",
        behaviorType: String(obj["subtype"] ?? "")
      };
      if (obj["override_id"] != null) subtree.overrideId = String(obj["override_id"]);
      if (obj["bindings"] != null && typeof obj["bindings"] === "object" && !Array.isArray(obj["bindings"])) {
        const raw = obj["bindings"];
        const bindings = {};
        for (const [k, v] of Object.entries(raw)) bindings[k] = String(v);
        if (Object.keys(bindings).length > 0) subtree.bindings = bindings;
      }
      return subtree;
    }
    default:
      throw new Error(`Unknown BT JSON node type: "${type}"`);
  }
}
function parseJsonFile(jsonText) {
  const obj = JSON.parse(jsonText);
  const root = parseNode(obj);
  const dmType = typeof obj["dm_type"] === "string" && obj["dm_type"] ? obj["dm_type"] : void 0;
  const bindings = _parseBindingDeclarations(obj);
  return { root, dmType, ...bindings ? { bindings } : {} };
}
function _parseBindingDeclarations(obj) {
  const raw = obj["bindings"];
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return void 0;
  const decls = raw;
  const result = {};
  for (const [name, entry] of Object.entries(decls)) {
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      const e = entry;
      result[name] = {
        label: typeof e["label"] === "string" ? e["label"] : name,
        default: typeof e["default"] !== "undefined" ? String(e["default"]) : ""
      };
    }
  }
  return Object.keys(result).length > 0 ? result : void 0;
}

// src/diff/btNodeUtils.ts
function getChildren(node) {
  switch (node.kind) {
    case "selector":
    case "sequence":
    case "parallel":
    case "subplan":
      return node.children;
    case "decorator":
      return node.child ? [node.child] : [];
    case "leaf":
    case "subtree":
      return [];
  }
}

// src/diff/hash.ts
var crypto = __toESM(require("crypto"));

// src/diff/canonical.ts
function canonicalVars(vars) {
  return Object.keys(vars).sort().map((k) => {
    const v = vars[k];
    return `${k}:${Array.isArray(v) ? v.join(",") : v}`;
  }).join(";");
}
function canonicalBindings(bindings) {
  if (!bindings) return "";
  return Object.keys(bindings).sort().map((k) => `${k}:${bindings[k]}`).join(";");
}

// src/diff/hash.ts
function subtreeHash(node) {
  const parts = [node.kind];
  switch (node.kind) {
    case "selector":
    case "sequence":
      break;
    case "parallel":
    case "subplan": {
      const schema = COMPOSITE_SCHEMAS[node.kind] ?? [];
      const src = node;
      for (const prop of schema) parts.push(`${prop.key}=${String(src[prop.key])}`);
      break;
    }
    case "leaf":
      parts.push(`behaviorType=${node.behaviorType}`);
      parts.push(`vars=${canonicalVars(node.vars)}`);
      break;
    case "subtree":
      parts.push(`behaviorType=${node.behaviorType}`);
      parts.push(`overrideId=${node.overrideId ?? ""}`);
      parts.push(`bindings=${canonicalBindings(node.bindings)}`);
      break;
    case "decorator":
      parts.push(`nodeType=${node.nodeType}`);
      parts.push(`vars=${canonicalVars(node.vars)}`);
      break;
  }
  for (const child of getChildren(node)) parts.push(subtreeHash(child));
  return crypto.createHash("sha1").update(parts.join("|")).digest("hex");
}
function signature(node) {
  switch (node.kind) {
    case "selector":
    case "sequence":
    case "parallel":
    case "subplan":
      return node.kind;
    case "leaf":
    case "subtree":
      return `${node.kind}:${node.behaviorType}`;
    case "decorator":
      return `${node.kind}:${node.nodeType}`;
  }
}

// src/diff/diff.ts
function diffTree(oldRoot, newRoot) {
  if (oldRoot === null && newRoot === null) {
    throw new Error("diffTree: at least one of oldRoot/newRoot must be present");
  }
  if (oldRoot === null) return makeTree(newRoot, void 0, "added");
  if (newRoot === null) return makeTree(oldRoot, void 0, "removed");
  return diffPairedNode(oldRoot, newRoot);
}
function diffPairedNode(oldNode, newNode) {
  const changedFields = compareOwnFields(oldNode, newNode);
  const children = diffChildren(getChildren(oldNode), getChildren(newNode));
  if (changedFields.length === 0) {
    return { status: "unchanged", node: newNode, counterpart: oldNode, children };
  }
  return { status: "changed", node: newNode, counterpart: oldNode, changedFields, children };
}
function makeTree(node, counterpart, status) {
  const counterpartKids = counterpart ? getChildren(counterpart) : [];
  return {
    status,
    node,
    counterpart,
    children: getChildren(node).map((c, i) => makeTree(c, counterpartKids[i], status))
  };
}
function diffChildren(oldKids, newKids) {
  const oldHashes = oldKids.map(subtreeHash);
  const newHashes = newKids.map(subtreeHash);
  const oldSigs = oldKids.map(signature);
  const newSigs = newKids.map(signature);
  const usedOld = new Array(oldKids.length).fill(false);
  const usedNew = new Array(newKids.length).fill(false);
  const hashMatch = /* @__PURE__ */ new Map();
  for (let ni = 0; ni < newKids.length; ni++) {
    const oi = oldHashes.findIndex((h, idx) => !usedOld[idx] && h === newHashes[ni]);
    if (oi !== -1) {
      usedOld[oi] = true;
      usedNew[ni] = true;
      hashMatch.set(ni, oi);
    }
  }
  const sigMatch = /* @__PURE__ */ new Map();
  for (let ni = 0; ni < newKids.length; ni++) {
    if (usedNew[ni]) continue;
    const oi = oldSigs.findIndex((s, idx) => !usedOld[idx] && s === newSigs[ni]);
    if (oi !== -1) {
      usedOld[oi] = true;
      usedNew[ni] = true;
      sigMatch.set(ni, oi);
    }
  }
  const results = [];
  for (let oi = 0; oi < oldKids.length; oi++) {
    if (!usedOld[oi]) results.push(makeTree(oldKids[oi], void 0, "removed"));
  }
  for (let ni = 0; ni < newKids.length; ni++) {
    if (hashMatch.has(ni)) {
      results.push(makeTree(newKids[ni], oldKids[hashMatch.get(ni)], "unchanged"));
    } else if (sigMatch.has(ni)) {
      results.push(diffPairedNode(oldKids[sigMatch.get(ni)], newKids[ni]));
    } else {
      results.push(makeTree(newKids[ni], void 0, "added"));
    }
  }
  return results;
}
function compareOwnFields(oldNode, newNode) {
  if (oldNode.kind !== newNode.kind) return ["kind"];
  switch (oldNode.kind) {
    case "selector":
    case "sequence":
      return [];
    case "parallel":
    case "subplan": {
      const schema = COMPOSITE_SCHEMAS[oldNode.kind] ?? [];
      const a = oldNode;
      const b = newNode;
      return schema.filter((prop) => a[prop.key] !== b[prop.key]).map((prop) => prop.key);
    }
    case "leaf": {
      const b = newNode;
      const changed = [];
      if (oldNode.behaviorType !== b.behaviorType) changed.push("behaviorType");
      if (canonicalVars(oldNode.vars) !== canonicalVars(b.vars)) changed.push("vars");
      return changed;
    }
    case "subtree": {
      const b = newNode;
      const changed = [];
      if (oldNode.behaviorType !== b.behaviorType) changed.push("behaviorType");
      if (oldNode.overrideId !== b.overrideId) changed.push("overrideId");
      if (canonicalBindings(oldNode.bindings) !== canonicalBindings(b.bindings)) {
        changed.push("bindings");
      }
      return changed;
    }
    case "decorator": {
      const b = newNode;
      const changed = [];
      if (oldNode.nodeType !== b.nodeType) changed.push("nodeType");
      if (canonicalVars(oldNode.vars) !== canonicalVars(b.vars)) changed.push("vars");
      return changed;
    }
  }
}

// media/editor/layout/dagreLayout.ts
var import_dagre = __toESM(require_dagre());

// media/editor/utils/nodeRows.ts
function lastSegment(v) {
  const trimmed = v.trim();
  const parts = trimmed.split("/").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
}
function rowsFor(config, varDecls, resolveBinding = (v) => v) {
  const rows = [];
  if (varDecls.length > 0) {
    for (const v of varDecls) {
      const val = config[v.name];
      if (val !== void 0) {
        rows.push({
          key: v.name,
          value: Array.isArray(val) ? `[${val.length}]` : lastSegment(resolveBinding(val)),
          isDefault: false
        });
      } else if (v.defaultValue !== "null") {
        rows.push({ key: v.name, value: v.defaultValue, isDefault: true });
      }
    }
  } else {
    for (const [k, v] of Object.entries(config)) {
      rows.push({
        key: k,
        value: Array.isArray(v) ? `[${v.length}]` : lastSegment(resolveBinding(v)),
        isDefault: false
      });
    }
  }
  return rows;
}

// media/editor/layout/dagreLayout.ts
var ROOT_NODE_ID = "__root__";
var ROOT_W = 80;
var ROOT_H = 30;
var nodeCounter = 0;
function nextId() {
  return `n${nodeCounter++}`;
}
function collectNodes(btNode, parentId, isDecoratorChild, siblingIndex, out, edges) {
  const id = nextId();
  out.push({ id, btNode, parentId, isDecoratorChild, siblingIndex });
  if (parentId !== null) {
    edges.push({ source: parentId, target: id, isDecorator: isDecoratorChild });
  }
  switch (btNode.kind) {
    case "selector":
    case "sequence":
    case "parallel":
    case "subplan":
      for (let i = 0; i < btNode.children.length; i++) {
        collectNodes(btNode.children[i], id, false, i, out, edges);
      }
      break;
    case "leaf":
      break;
    case "subtree":
      break;
    case "decorator":
      if (btNode.child) collectNodes(btNode.child, id, true, null, out, edges);
      break;
  }
  return id;
}
function nodeSize(btNode, typeVars) {
  const W = 220;
  switch (btNode.kind) {
    case "leaf": {
      const varDecls = typeVars?.[btNode.behaviorType]?.vars ?? [];
      const n = rowsFor(btNode.vars, varDecls).length;
      return { width: W, height: n > 0 ? 34 + n * 18 : 52 };
    }
    case "decorator": {
      const varDecls = typeVars?.[btNode.nodeType]?.vars ?? [];
      const n = rowsFor(btNode.vars, varDecls).length;
      return { width: W, height: 36 + (n > 0 ? n * 18 + 4 : 0) };
    }
    case "parallel":
      return { width: W, height: 108 };
    case "subplan":
      return { width: W, height: 88 };
    case "subtree":
      return { width: W, height: 52 };
    default:
      return { width: W, height: 48 };
  }
}
function nodeType(btNode) {
  switch (btNode.kind) {
    case "selector":
      return "selectorNode";
    case "sequence":
      return "sequenceNode";
    case "parallel":
      return "parallelNode";
    case "subplan":
      return "subplanNode";
    case "leaf":
      return "leafNode";
    case "subtree":
      return "subtreeNode";
    case "decorator":
      return "decoratorNode";
  }
}
function nodeData(btNode) {
  switch (btNode.kind) {
    case "selector":
    case "sequence":
      return {};
    case "parallel":
    case "subplan": {
      const src = btNode;
      const data = {};
      for (const prop of COMPOSITE_SCHEMAS[btNode.kind] ?? []) data[prop.key] = src[prop.key];
      return data;
    }
    case "leaf":
      return { behaviorType: btNode.behaviorType, vars: btNode.vars };
    case "subtree":
      return { behaviorType: btNode.behaviorType };
    case "decorator":
      return { nodeType: btNode.nodeType, vars: btNode.vars };
  }
}
function buildLayout(root, includeRootStub = false, typeVars, sizeFn = nodeSize) {
  nodeCounter = 0;
  const layoutNodes = [];
  const rawEdges = [];
  collectNodes(root, null, false, null, layoutNodes, rawEdges);
  const g = new import_dagre.default.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", ranksep: 50, nodesep: 60 });
  if (includeRootStub) {
    g.setNode(ROOT_NODE_ID, { width: ROOT_W, height: ROOT_H });
    g.setEdge(ROOT_NODE_ID, layoutNodes[0].id, { minlen: 2 });
  }
  for (const ln of layoutNodes) {
    const size = sizeFn(ln.btNode, typeVars);
    g.setNode(ln.id, { width: size.width, height: size.height });
  }
  for (const e of rawEdges) {
    g.setEdge(e.source, e.target, e.isDecorator ? { minlen: 1 } : { minlen: 2 });
  }
  import_dagre.default.layout(g);
  {
    const subtreeIds = (id) => {
      const result = [id];
      for (const ln of layoutNodes) {
        if (ln.parentId === id) result.push(...subtreeIds(ln.id));
      }
      return result;
    };
    for (const ln of layoutNodes) {
      const children = layoutNodes.filter(
        (c) => c.parentId === ln.id && !c.isDecoratorChild && c.siblingIndex !== null
      );
      if (children.length < 2) continue;
      const byIndex = [...children].sort((a, b) => (a.siblingIndex ?? 0) - (b.siblingIndex ?? 0));
      const xSlots = byIndex.map((c) => g.node(c.id).x).sort((a, b) => a - b);
      if (byIndex.every((c, i) => Math.abs(g.node(c.id).x - xSlots[i]) < 0.5)) continue;
      const moves = byIndex.map((c, i) => ({
        ids: subtreeIds(c.id),
        dx: xSlots[i] - g.node(c.id).x
      }));
      for (const { ids, dx } of moves) {
        if (Math.abs(dx) < 0.01) continue;
        for (const id of ids) {
          const pos = g.node(id);
          g.setNode(id, { ...pos, x: pos.x + dx });
        }
      }
    }
  }
  {
    const GAP = 20;
    const _subtreeIdCache = /* @__PURE__ */ new Map();
    const allSubtreeIds = (id) => {
      const cached = _subtreeIdCache.get(id);
      if (cached) return cached;
      const result = [id];
      for (const ln of layoutNodes) {
        if (ln.parentId === id) result.push(...allSubtreeIds(ln.id));
      }
      _subtreeIdCache.set(id, result);
      return result;
    };
    const subtreeBounds = (id) => {
      let minX = Infinity, maxX = -Infinity;
      for (const sid of allSubtreeIds(id)) {
        const ln2 = layoutNodes.find((n) => n.id === sid);
        const sz = sizeFn(ln2.btNode, typeVars);
        const pos = g.node(sid);
        if (pos.x - sz.width / 2 < minX) minX = pos.x - sz.width / 2;
        if (pos.x + sz.width / 2 > maxX) maxX = pos.x + sz.width / 2;
      }
      return { minX, maxX };
    };
    const shiftSubtree = (id, dx) => {
      if (Math.abs(dx) < 0.01) return;
      for (const sid of allSubtreeIds(id)) {
        const pos = g.node(sid);
        g.setNode(sid, { ...pos, x: pos.x + dx });
      }
    };
    for (const ln of [...layoutNodes].reverse()) {
      const children = layoutNodes.filter(
        (c) => c.parentId === ln.id && !c.isDecoratorChild && c.siblingIndex !== null
      );
      if (children.length < 2) continue;
      const byIndex = [...children].sort((a, b) => (a.siblingIndex ?? 0) - (b.siblingIndex ?? 0));
      for (let i = 1; i < byIndex.length; i++) {
        const prevBounds = subtreeBounds(byIndex[i - 1].id);
        const currBounds = subtreeBounds(byIndex[i].id);
        const gap = currBounds.minX - prevBounds.maxX;
        if (gap < GAP) {
          shiftSubtree(byIndex[i].id, GAP - gap);
        }
      }
      const firstX = g.node(byIndex[0].id).x;
      const lastX = g.node(byIndex[byIndex.length - 1].id).x;
      const parentPos = g.node(ln.id);
      g.setNode(ln.id, { ...parentPos, x: (firstX + lastX) / 2 });
    }
  }
  const nodes = layoutNodes.map((ln) => {
    const pos = g.node(ln.id);
    const size = sizeFn(ln.btNode, typeVars);
    return {
      id: ln.id,
      type: nodeType(ln.btNode),
      position: { x: pos.x - size.width / 2, y: pos.y - size.height / 2 },
      data: { ...nodeData(ln.btNode), _btNode: ln.btNode, childIndex: ln.siblingIndex },
      style: { width: size.width }
    };
  });
  const edges = rawEdges.map((e, i) => ({
    id: `e${i}`,
    source: e.source,
    target: e.target,
    type: e.isDecorator ? "straight" : "smoothstep",
    style: e.isDecorator ? { stroke: "#607D8B", strokeWidth: 3 } : { stroke: "#555", strokeWidth: 1.5 },
    markerEnd: e.isDecorator ? void 0 : { type: "arrowclosed" }
  }));
  if (includeRootStub) {
    const pos = g.node(ROOT_NODE_ID);
    nodes.unshift({
      id: ROOT_NODE_ID,
      type: "rootNode",
      position: { x: pos.x - ROOT_W / 2, y: pos.y - ROOT_H / 2 },
      data: {},
      deletable: false,
      draggable: false,
      selectable: false,
      style: { width: ROOT_W }
    });
    edges.unshift({
      id: "e__root__",
      source: ROOT_NODE_ID,
      target: layoutNodes[0].id,
      type: "smoothstep",
      style: { stroke: "#555", strokeWidth: 1.5, strokeDasharray: "4 3" },
      markerEnd: { type: "arrowclosed" },
      deletable: false,
      reconnectable: false
    });
  }
  return { nodes, edges };
}

// media/editor/utils/typeDisplay.ts
var PREFIXES = [
  "/datum/bt_node/ai_behavior/",
  "/datum/bt_node/decorator/",
  "/datum/bt_node/subtree/",
  "/datum/ai_controller/"
];
function shortTypePath(typePath) {
  for (const prefix of PREFIXES) {
    if (typePath.startsWith(prefix)) {
      return typePath.slice(prefix.length);
    }
  }
  return typePath.split("/").filter(Boolean).pop() ?? typePath;
}

// src/diff/svg.ts
var KIND_STYLE = {
  selector: { bg: "#1e3a1e", border: "#4CAF50" },
  sequence: { bg: "#1a2a3a", border: "#2196F3" },
  parallel: { bg: "#2a1a3a", border: "#9C27B0" },
  subplan: { bg: "#2a1e00", border: "#FFB300" },
  leaf: { bg: "#2a1e00", border: "#FF9800" },
  decorator: { bg: "#1a1a1a", border: "#607D8B" },
  subtree: { bg: "#00292d", border: "#26C6DA" }
};
var KIND_ICON = {
  selector: "?",
  sequence: "\u2192",
  parallel: "\u21C9",
  subplan: "\u21BA",
  subtree: "\u21B5"
};
var STATUS_STYLE = {
  unchanged: {},
  added: { border: "#4CAF50", badge: "+" },
  removed: { border: "#f44336", badge: "\u2212", dash: true, opacity: 0.55 },
  changed: { border: "#FFC107", badge: "~" }
};
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function truncate(s, max) {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}
function nodeContent(node, typeVars, resolveBinding) {
  switch (node.kind) {
    case "selector":
      return { title: "Selector", rows: [] };
    case "sequence":
      return { title: "Sequence", rows: [] };
    case "parallel":
    case "subplan": {
      const schema = COMPOSITE_SCHEMAS[node.kind] ?? [];
      const src = node;
      const rows = [];
      for (const prop of schema) {
        const raw = src[prop.key];
        if (prop.type === "text" && (raw == null || raw === "")) continue;
        let display;
        if (prop.type === "enum") display = raw != null ? BT_LABELS[raw] ?? String(raw) : "\u2014";
        else if (prop.type === "boolean") display = raw != null ? raw ? "yes" : "no" : "\u2014";
        else display = String(raw);
        rows.push({ key: prop.label, value: display });
      }
      return { title: node.kind === "parallel" ? "Parallel" : "Subplan", rows };
    }
    case "leaf": {
      const varDecls = typeVars?.[node.behaviorType]?.vars ?? [];
      return { title: shortTypePath(resolveBinding(node.behaviorType)), rows: rowsFor(node.vars, varDecls, resolveBinding) };
    }
    case "decorator": {
      const varDecls = typeVars?.[node.nodeType]?.vars ?? [];
      return { title: shortTypePath(resolveBinding(node.nodeType)), rows: rowsFor(node.vars, varDecls, resolveBinding) };
    }
    case "subtree": {
      const rows = [{ key: "path", value: shortTypePath(resolveBinding(node.behaviorType)) }];
      if (node.overrideId) rows.push({ key: "id", value: node.overrideId });
      const bindingCount = node.bindings ? Object.keys(node.bindings).length : 0;
      if (bindingCount > 0) rows.push({ key: "overrides", value: String(bindingCount) });
      return { title: "Subtree Ref", rows };
    }
  }
}
function zipRows(oldRows, newRows) {
  const oldMap = new Map(oldRows.map((r) => [r.key, r.value]));
  const newMap = new Map(newRows.map((r) => [r.key, r.value]));
  const keys = [];
  for (const r of newRows) if (!keys.includes(r.key)) keys.push(r.key);
  for (const r of oldRows) if (!keys.includes(r.key)) keys.push(r.key);
  return keys.map((key) => {
    const hasOld = oldMap.has(key);
    const hasNew = newMap.has(key);
    if (hasOld && hasNew) {
      const oldValue = oldMap.get(key);
      const newValue = newMap.get(key);
      return oldValue === newValue ? { key, status: "same", value: newValue } : { key, status: "changed", oldValue, newValue };
    }
    if (hasNew) return { key, status: "added", value: newMap.get(key) };
    return { key, status: "removed", value: oldMap.get(key) };
  });
}
function diffContent(d, typeVars, resolveBinding) {
  const oldNode = d.counterpart;
  if (!oldNode || oldNode.kind !== d.node.kind) {
    const newContent2 = nodeContent(d.node, typeVars, resolveBinding);
    if (!oldNode) return { title: newContent2.title, rows: newContent2.rows.map((r) => ({ ...r, status: "same" })) };
    return {
      title: newContent2.title,
      rows: [{ key: "kind", status: "changed", oldValue: oldNode.kind, newValue: d.node.kind }]
    };
  }
  const oldContent = nodeContent(oldNode, typeVars, resolveBinding);
  const newContent = nodeContent(d.node, typeVars, resolveBinding);
  return {
    title: newContent.title,
    oldTitle: oldContent.title !== newContent.title ? oldContent.title : void 0,
    rows: zipRows(oldContent.rows, newContent.rows)
  };
}
function diffRowLines(rows) {
  return rows.reduce((n, r) => n + (r.status === "changed" ? 2 : 1), 0);
}
var BASE_W = 220;
function diffNodeSize(d, typeVars, resolveBinding) {
  if (d.status !== "changed") return nodeSize(d.node, typeVars);
  const content = diffContent(d, typeVars, resolveBinding);
  const n = diffRowLines(content.rows);
  const titleExtra = content.oldTitle ? 14 : 0;
  switch (d.node.kind) {
    case "leaf":
      return { width: BASE_W, height: (n > 0 ? 34 + n * 18 : 52) + titleExtra };
    case "decorator":
      return { width: BASE_W, height: 36 + (n > 0 ? n * 18 + 4 : 0) + titleExtra };
    case "parallel":
    case "subplan":
    case "subtree":
      return { width: BASE_W, height: Math.max(nodeSize(d.node, typeVars).height, 34 + n * 18) + titleExtra };
    default:
      return { width: BASE_W, height: 48 + titleExtra };
  }
}
function toSyntheticTree(d, ctx) {
  const base = d.node;
  let synthetic;
  switch (base.kind) {
    case "selector":
    case "sequence":
    case "parallel":
    case "subplan":
      synthetic = { ...base, children: d.children.map((c) => toSyntheticTree(c, ctx)) };
      break;
    case "decorator":
      synthetic = { ...base, child: d.children[0] ? toSyntheticTree(d.children[0], ctx) : void 0 };
      break;
    case "leaf":
    case "subtree":
      synthetic = { ...base };
      break;
  }
  ctx.diffOf.set(synthetic, d);
  return synthetic;
}
function renderNode(n, typeVars, resolveBinding, diffOf) {
  const syntheticNode = n.data._btNode;
  const d = diffOf.get(syntheticNode);
  const status = d.status;
  const { width, height } = diffNodeSize(d, typeVars, resolveBinding);
  const style = KIND_STYLE[syntheticNode.kind];
  const icon = KIND_ICON[syntheticNode.kind];
  const s = STATUS_STYLE[status];
  let g = `<g transform="translate(${n.position.x},${n.position.y})" opacity="${s.opacity ?? 1}">`;
  g += `<rect width="${width}" height="${height}" rx="4" fill="${style.bg}" stroke="${s.border ?? style.border}" stroke-width="${s.border ? 2 : 1}"${s.dash ? ' stroke-dasharray="4 3"' : ""}/>`;
  g += `<rect width="4" height="${height}" fill="${style.border}"/>`;
  let ty = 20;
  if (status === "changed") {
    const content = diffContent(d, typeVars, resolveBinding);
    const titleText = icon ? `<text x="10" y="${ty}" font-size="14" font-weight="700" fill="${style.border}">${icon}</text><text x="26" y="${ty}" font-size="12" font-weight="700" fill="#ccc">${escapeXml(truncate(content.title, 22))}</text>` : `<text x="10" y="${ty}" font-size="12" font-weight="700" fill="${style.border}">${escapeXml(truncate(content.title, 28))}</text>`;
    g += titleText;
    ty += 18;
    if (content.oldTitle) {
      g += `<text x="10" y="${ty}" font-size="9" fill="#f44336" text-decoration="line-through">${escapeXml(truncate(content.oldTitle, 30))}</text>`;
      ty += 14;
    }
    for (const row of content.rows) {
      if (row.status === "same") {
        g += `<text x="10" y="${ty}" font-size="10" fill="#aaa">${escapeXml(truncate(row.key, 14))}</text>`;
        g += `<text x="80" y="${ty}" font-size="10" fill="#e0e0e0">${escapeXml(truncate(row.value, 22))}</text>`;
        ty += 18;
      } else if (row.status === "added") {
        g += `<text x="10" y="${ty}" font-size="10" fill="#aaa">${escapeXml(truncate(row.key, 14))}</text>`;
        g += `<text x="80" y="${ty}" font-size="10" fill="#4CAF50">+ ${escapeXml(truncate(row.value, 20))}</text>`;
        ty += 18;
      } else if (row.status === "removed") {
        g += `<text x="10" y="${ty}" font-size="10" fill="#aaa">${escapeXml(truncate(row.key, 14))}</text>`;
        g += `<text x="80" y="${ty}" font-size="10" fill="#f44336" text-decoration="line-through">${escapeXml(truncate(row.value, 20))}</text>`;
        ty += 18;
      } else {
        g += `<text x="10" y="${ty}" font-size="10" fill="#aaa">${escapeXml(truncate(row.key, 14))}</text>`;
        g += `<text x="80" y="${ty}" font-size="9" fill="#f44336" text-decoration="line-through">${escapeXml(truncate(row.oldValue, 22))}</text>`;
        ty += 14;
        g += `<text x="80" y="${ty}" font-size="10" fill="#FFC107">${escapeXml(truncate(row.newValue, 22))}</text>`;
        ty += 18;
      }
    }
  } else {
    const { title, rows } = nodeContent(syntheticNode, typeVars, resolveBinding);
    if (icon) {
      g += `<text x="10" y="${ty}" font-size="14" font-weight="700" fill="${style.border}">${icon}</text>`;
      g += `<text x="26" y="${ty}" font-size="12" font-weight="700" fill="#ccc">${escapeXml(truncate(title, 22))}</text>`;
    } else {
      g += `<text x="10" y="${ty}" font-size="12" font-weight="700" fill="${style.border}">${escapeXml(truncate(title, 28))}</text>`;
    }
    ty += 18;
    for (const row of rows) {
      const valColor = row.isDefault ? "#666" : "#e0e0e0";
      g += `<text x="10" y="${ty}" font-size="10" fill="#aaa">${escapeXml(truncate(row.key, 14))}</text>`;
      g += `<text x="80" y="${ty}" font-size="10" fill="${valColor}"${row.isDefault ? ' font-style="italic"' : ""}>${escapeXml(truncate(row.value, 22))}</text>`;
      ty += 18;
    }
  }
  if (typeof n.data.childIndex === "number") {
    g += `<text x="${width - 8}" y="12" font-size="9" font-weight="700" fill="rgba(200,200,200,0.5)" text-anchor="end">${n.data.childIndex + 1}</text>`;
  }
  if (s.badge) {
    g += `<circle cx="10" cy="10" r="8" fill="${s.border}"/>`;
    g += `<text x="10" y="13" font-size="10" font-weight="700" text-anchor="middle" fill="#111">${s.badge}</text>`;
  }
  g += "</g>";
  return g;
}
function renderEdges(nodes, edges, typeVars, resolveBinding, diffOf) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sizeOf = (n) => diffNodeSize(diffOf.get(n.data._btNode), typeVars, resolveBinding);
  let out = "";
  for (const e of edges) {
    const source = byId.get(e.source);
    const target = byId.get(e.target);
    if (!source || !target) continue;
    const sSize = sizeOf(source);
    const tSize = sizeOf(target);
    const sx = source.position.x + sSize.width / 2;
    const sy = source.position.y + sSize.height;
    const tx = target.position.x + tSize.width / 2;
    const ty = target.position.y;
    const isDecorator = e.type === "straight";
    const stroke = isDecorator ? "#607D8B" : "#555";
    const w = isDecorator ? 3 : 1.5;
    if (isDecorator) {
      out += `<line x1="${sx}" y1="${sy}" x2="${tx}" y2="${ty}" stroke="${stroke}" stroke-width="${w}"/>`;
    } else {
      const midY = (sy + ty) / 2;
      out += `<path d="M ${sx} ${sy} L ${sx} ${midY} L ${tx} ${midY} L ${tx} ${ty}" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
      out += `<polygon points="${tx - 4},${ty - 6} ${tx + 4},${ty - 6} ${tx},${ty}" fill="${stroke}"/>`;
    }
  }
  return out;
}
function boundingBox(nodes, typeVars, resolveBinding, diffOf) {
  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    const { width, height } = diffNodeSize(diffOf.get(n.data._btNode), typeVars, resolveBinding);
    maxX = Math.max(maxX, n.position.x + width);
    maxY = Math.max(maxY, n.position.y + height);
  }
  return { width: maxX, height: maxY };
}
var LEGEND_ITEMS = [
  { badge: "+", color: "#4CAF50", label: "added" },
  { badge: "\u2212", color: "#f44336", label: "removed" },
  { badge: "~", color: "#FFC107", label: "changed" }
];
function renderLegend() {
  const ITEM_W = 100;
  const H = 20;
  let svg = "";
  LEGEND_ITEMS.forEach((item, i) => {
    const x = i * ITEM_W;
    svg += `<circle cx="${x + 8}" cy="${H / 2}" r="8" fill="${item.color}"/>`;
    svg += `<text x="${x + 8}" y="${H / 2 + 3}" font-size="10" font-weight="700" text-anchor="middle" fill="#111">${item.badge}</text>`;
    svg += `<text x="${x + 22}" y="${H / 2 + 4}" font-size="11" fill="#ccc">${escapeXml(item.label)}</text>`;
  });
  return { svg, width: LEGEND_ITEMS.length * ITEM_W, height: H };
}
function renderDiffSvg(diff, typeVars) {
  const resolveBinding = (v) => v;
  const diffOf = /* @__PURE__ */ new WeakMap();
  const syntheticRoot = toSyntheticTree(diff, { diffOf });
  const sizeFn = (btNode, tv) => diffNodeSize(diffOf.get(btNode), tv, resolveBinding);
  const { nodes, edges } = buildLayout(syntheticRoot, false, typeVars, sizeFn);
  const { width: treeWidth, height: treeHeight } = boundingBox(nodes, typeVars, resolveBinding, diffOf);
  const PAD = 20;
  const LEGEND_H = 24;
  const legend = renderLegend();
  const totalWidth = PAD * 2 + Math.max(treeWidth, legend.width);
  const totalHeight = PAD * 2 + LEGEND_H + treeHeight;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`;
  svg += `<rect width="${totalWidth}" height="${totalHeight}" fill="#1e1e1e"/>`;
  svg += `<g transform="translate(${PAD},${PAD})">${legend.svg}</g>`;
  svg += `<g transform="translate(${PAD},${PAD + LEGEND_H})">`;
  svg += renderEdges(nodes, edges, typeVars, resolveBinding, diffOf);
  for (const n of nodes) svg += renderNode(n, typeVars, resolveBinding, diffOf);
  svg += "</g>";
  svg += "</svg>";
  return svg;
}

// src/diff/pipeline.ts
var DEFAULT_MAX_NODES = 500;
var TreeTooLargeError = class extends Error {
  constructor(count, max) {
    super(`tree has ${count} nodes, exceeding the limit of ${max}`);
    this.count = count;
    this.max = max;
  }
};
function countNodes(node) {
  return 1 + getChildren(node).reduce((sum, c) => sum + countNodes(c), 0);
}
function parseOrNull(text) {
  return text === null ? null : parseJsonFile(text).root;
}
function diffBtJsonTexts(oldText, newText, typeVars, maxNodes = DEFAULT_MAX_NODES) {
  const oldRoot = parseOrNull(oldText);
  const newRoot = parseOrNull(newText);
  for (const root of [oldRoot, newRoot]) {
    if (!root) continue;
    const count = countNodes(root);
    if (count > maxNodes) throw new TreeTooLargeError(count, maxNodes);
  }
  return renderDiffSvg(diffTree(oldRoot, newRoot), typeVars);
}

// src/action/handler.ts
var MAX_FILES = 25;
var COMMENT_MARKER = "<!-- behaviortreediffbot -->";
async function renderOne(client, ref, file) {
  const oldText = file.status === "added" ? null : await client.fetchFileAtRef(ref.owner, ref.repo, file.path, ref.baseSha);
  const newText = file.status === "removed" ? null : await client.fetchFileAtRef(ref.owner, ref.repo, file.path, ref.headSha);
  if (oldText === null && newText === null) {
    return { path: file.path, note: "could not read this file on either side" };
  }
  try {
    return { path: file.path, svg: diffBtJsonTexts(oldText, newText) };
  } catch (err) {
    if (err instanceof TreeTooLargeError) {
      return { path: file.path, note: `tree too large to render (${err.count} nodes, limit ${err.max})` };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { path: file.path, note: `failed to render: ${message}`, failed: true };
  }
}
async function renderPullRequestDiffs(client, ref) {
  const files = await client.listChangedBtJsonFiles(ref.owner, ref.repo, ref.prNumber);
  const rendered = [];
  for (const file of files.slice(0, MAX_FILES)) {
    rendered.push(await renderOne(client, ref, file));
  }
  return { files: rendered, truncated: Math.max(0, files.length - MAX_FILES) };
}
function buildCommentBody(sections, truncated) {
  const parts = [COMMENT_MARKER, "## Behavior tree diff", ...sections];
  if (truncated > 0) parts.push(`${truncated} more changed tree(s) not shown.`);
  return parts.join("\n\n");
}
async function publishDiffComment(client, host, ref, result) {
  const stale = (await client.listIssueComments(ref.owner, ref.repo, ref.prNumber)).filter(
    (c) => c.body.includes(COMMENT_MARKER)
  );
  if (result.files.length > 0) {
    const sections = [];
    for (const file of result.files) {
      if (file.svg) {
        const url = await host.upload(`${file.path.replace(/[^\w.-]/g, "_")}.svg`, Buffer.from(file.svg), "image/svg+xml");
        sections.push(`### \`${file.path}\`
![diff](${url})`);
      } else {
        sections.push(`### \`${file.path}\`
${file.note}`);
      }
    }
    await client.createIssueComment(ref.owner, ref.repo, ref.prNumber, buildCommentBody(sections, result.truncated));
  }
  for (const comment of stale) {
    await client.deleteIssueComment(ref.owner, ref.repo, comment.id);
  }
}

// src/action/imageHost.ts
var FileHouseImageHost = class {
  constructor(apiKey, endpoint2 = "https://file.house/api/upload") {
    this.apiKey = apiKey;
    this.endpoint = endpoint2;
  }
  async upload(filename, data, contentType) {
    const form = new FormData();
    form.set("key", this.apiKey);
    form.set("file", new Blob([new Uint8Array(data)], { type: contentType }), filename);
    const response = await fetch(this.endpoint, { method: "POST", body: form });
    if (!response.ok) {
      throw new Error(`upload of ${filename} failed: ${response.status} ${await response.text()}`);
    }
    const body = await response.json();
    if (typeof body.url !== "string") {
      throw new Error(`upload of ${filename} returned no url: ${JSON.stringify(body)}`);
    }
    return body.url;
  }
};

// src/action/octokit.ts
var fs = __toESM(require("fs"));

// node_modules/universal-user-agent/index.js
function getUserAgent() {
  if (typeof navigator === "object" && "userAgent" in navigator) {
    return navigator.userAgent;
  }
  if (typeof process === "object" && process.version !== void 0) {
    return `Node.js/${process.version.substr(1)} (${process.platform}; ${process.arch})`;
  }
  return "<environment undetectable>";
}

// node_modules/before-after-hook/lib/register.js
function register(state, name, method, options) {
  if (typeof method !== "function") {
    throw new Error("method for before hook must be a function");
  }
  if (!options) {
    options = {};
  }
  if (Array.isArray(name)) {
    return name.reverse().reduce((callback, name2) => {
      return register.bind(null, state, name2, callback, options);
    }, method)();
  }
  return Promise.resolve().then(() => {
    if (!state.registry[name]) {
      return method(options);
    }
    return state.registry[name].reduce((method2, registered) => {
      return registered.hook.bind(null, method2, options);
    }, method)();
  });
}

// node_modules/before-after-hook/lib/add.js
function addHook(state, kind, name, hook2) {
  const orig = hook2;
  if (!state.registry[name]) {
    state.registry[name] = [];
  }
  if (kind === "before") {
    hook2 = (method, options) => {
      return Promise.resolve().then(orig.bind(null, options)).then(method.bind(null, options));
    };
  }
  if (kind === "after") {
    hook2 = (method, options) => {
      let result;
      return Promise.resolve().then(method.bind(null, options)).then((result_) => {
        result = result_;
        return orig(result, options);
      }).then(() => {
        return result;
      });
    };
  }
  if (kind === "error") {
    hook2 = (method, options) => {
      return Promise.resolve().then(method.bind(null, options)).catch((error) => {
        return orig(error, options);
      });
    };
  }
  state.registry[name].push({
    hook: hook2,
    orig
  });
}

// node_modules/before-after-hook/lib/remove.js
function removeHook(state, name, method) {
  if (!state.registry[name]) {
    return;
  }
  const index = state.registry[name].map((registered) => {
    return registered.orig;
  }).indexOf(method);
  if (index === -1) {
    return;
  }
  state.registry[name].splice(index, 1);
}

// node_modules/before-after-hook/index.js
var bind = Function.bind;
var bindable = bind.bind(bind);
function bindApi(hook2, state, name) {
  const removeHookRef = bindable(removeHook, null).apply(
    null,
    name ? [state, name] : [state]
  );
  hook2.api = { remove: removeHookRef };
  hook2.remove = removeHookRef;
  ["before", "error", "after", "wrap"].forEach((kind) => {
    const args = name ? [state, kind, name] : [state, kind];
    hook2[kind] = hook2.api[kind] = bindable(addHook, null).apply(null, args);
  });
}
function Singular() {
  const singularHookName = Symbol("Singular");
  const singularHookState = {
    registry: {}
  };
  const singularHook = register.bind(null, singularHookState, singularHookName);
  bindApi(singularHook, singularHookState, singularHookName);
  return singularHook;
}
function Collection() {
  const state = {
    registry: {}
  };
  const hook2 = register.bind(null, state);
  bindApi(hook2, state);
  return hook2;
}
var before_after_hook_default = { Singular, Collection };

// node_modules/@octokit/endpoint/dist-bundle/index.js
var VERSION = "0.0.0-development";
var userAgent = `octokit-endpoint.js/${VERSION} ${getUserAgent()}`;
var DEFAULTS = {
  method: "GET",
  baseUrl: "https://api.github.com",
  headers: {
    accept: "application/vnd.github.v3+json",
    "user-agent": userAgent
  },
  mediaType: {
    format: ""
  }
};
function lowercaseKeys(object) {
  if (!object) {
    return {};
  }
  return Object.keys(object).reduce((newObj, key) => {
    newObj[key.toLowerCase()] = object[key];
    return newObj;
  }, {});
}
function isPlainObject(value) {
  if (typeof value !== "object" || value === null) return false;
  if (Object.prototype.toString.call(value) !== "[object Object]") return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null) return true;
  const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
}
function mergeDeep(defaults, options) {
  const result = Object.assign({}, defaults);
  Object.keys(options).forEach((key) => {
    if (isPlainObject(options[key])) {
      if (!(key in defaults)) Object.assign(result, { [key]: options[key] });
      else result[key] = mergeDeep(defaults[key], options[key]);
    } else {
      Object.assign(result, { [key]: options[key] });
    }
  });
  return result;
}
function removeUndefinedProperties(obj) {
  for (const key in obj) {
    if (obj[key] === void 0) {
      delete obj[key];
    }
  }
  return obj;
}
function merge(defaults, route, options) {
  if (typeof route === "string") {
    let [method, url] = route.split(" ");
    options = Object.assign(url ? { method, url } : { url: method }, options);
  } else {
    options = Object.assign({}, route);
  }
  options.headers = lowercaseKeys(options.headers);
  removeUndefinedProperties(options);
  removeUndefinedProperties(options.headers);
  const mergedOptions = mergeDeep(defaults || {}, options);
  if (options.url === "/graphql") {
    if (defaults && defaults.mediaType.previews?.length) {
      mergedOptions.mediaType.previews = defaults.mediaType.previews.filter(
        (preview) => !mergedOptions.mediaType.previews.includes(preview)
      ).concat(mergedOptions.mediaType.previews);
    }
    mergedOptions.mediaType.previews = (mergedOptions.mediaType.previews || []).map((preview) => preview.replace(/-preview/, ""));
  }
  return mergedOptions;
}
function addQueryParameters(url, parameters) {
  const separator = /\?/.test(url) ? "&" : "?";
  const names = Object.keys(parameters);
  if (names.length === 0) {
    return url;
  }
  return url + separator + names.map((name) => {
    if (name === "q") {
      return "q=" + parameters.q.split("+").map(encodeURIComponent).join("+");
    }
    return `${name}=${encodeURIComponent(parameters[name])}`;
  }).join("&");
}
var urlVariableRegex = /\{[^{}}]+\}/g;
function removeNonChars(variableName) {
  return variableName.replace(/(?:^\W+)|(?:(?<!\W)\W+$)/g, "").split(/,/);
}
function extractUrlVariableNames(url) {
  const matches = url.match(urlVariableRegex);
  if (!matches) {
    return [];
  }
  return matches.map(removeNonChars).reduce((a, b) => a.concat(b), []);
}
function omit(object, keysToOmit) {
  const result = { __proto__: null };
  for (const key of Object.keys(object)) {
    if (keysToOmit.indexOf(key) === -1) {
      result[key] = object[key];
    }
  }
  return result;
}
function encodeReserved(str) {
  return str.split(/(%[0-9A-Fa-f]{2})/g).map(function(part) {
    if (!/%[0-9A-Fa-f]/.test(part)) {
      part = encodeURI(part).replace(/%5B/g, "[").replace(/%5D/g, "]");
    }
    return part;
  }).join("");
}
function encodeUnreserved(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return "%" + c.charCodeAt(0).toString(16).toUpperCase();
  });
}
function encodeValue(operator, value, key) {
  value = operator === "+" || operator === "#" ? encodeReserved(value) : encodeUnreserved(value);
  if (key) {
    return encodeUnreserved(key) + "=" + value;
  } else {
    return value;
  }
}
function isDefined(value) {
  return value !== void 0 && value !== null;
}
function isKeyOperator(operator) {
  return operator === ";" || operator === "&" || operator === "?";
}
function getValues(context, operator, key, modifier) {
  var value = context[key], result = [];
  if (isDefined(value) && value !== "") {
    if (typeof value === "string" || typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") {
      value = value.toString();
      if (modifier && modifier !== "*") {
        value = value.substring(0, parseInt(modifier, 10));
      }
      result.push(
        encodeValue(operator, value, isKeyOperator(operator) ? key : "")
      );
    } else {
      if (modifier === "*") {
        if (Array.isArray(value)) {
          value.filter(isDefined).forEach(function(value2) {
            result.push(
              encodeValue(operator, value2, isKeyOperator(operator) ? key : "")
            );
          });
        } else {
          Object.keys(value).forEach(function(k) {
            if (isDefined(value[k])) {
              result.push(encodeValue(operator, value[k], k));
            }
          });
        }
      } else {
        const tmp = [];
        if (Array.isArray(value)) {
          value.filter(isDefined).forEach(function(value2) {
            tmp.push(encodeValue(operator, value2));
          });
        } else {
          Object.keys(value).forEach(function(k) {
            if (isDefined(value[k])) {
              tmp.push(encodeUnreserved(k));
              tmp.push(encodeValue(operator, value[k].toString()));
            }
          });
        }
        if (isKeyOperator(operator)) {
          result.push(encodeUnreserved(key) + "=" + tmp.join(","));
        } else if (tmp.length !== 0) {
          result.push(tmp.join(","));
        }
      }
    }
  } else {
    if (operator === ";") {
      if (isDefined(value)) {
        result.push(encodeUnreserved(key));
      }
    } else if (value === "" && (operator === "&" || operator === "?")) {
      result.push(encodeUnreserved(key) + "=");
    } else if (value === "") {
      result.push("");
    }
  }
  return result;
}
function parseUrl(template) {
  return {
    expand: expand.bind(null, template)
  };
}
function expand(template, context) {
  var operators = ["+", "#", ".", "/", ";", "?", "&"];
  template = template.replace(
    /\{([^\{\}]+)\}|([^\{\}]+)/g,
    function(_, expression, literal) {
      if (expression) {
        let operator = "";
        const values = [];
        if (operators.indexOf(expression.charAt(0)) !== -1) {
          operator = expression.charAt(0);
          expression = expression.substr(1);
        }
        expression.split(/,/g).forEach(function(variable) {
          var tmp = /([^:\*]*)(?::(\d+)|(\*))?/.exec(variable);
          values.push(getValues(context, operator, tmp[1], tmp[2] || tmp[3]));
        });
        if (operator && operator !== "+") {
          var separator = ",";
          if (operator === "?") {
            separator = "&";
          } else if (operator !== "#") {
            separator = operator;
          }
          return (values.length !== 0 ? operator : "") + values.join(separator);
        } else {
          return values.join(",");
        }
      } else {
        return encodeReserved(literal);
      }
    }
  );
  if (template === "/") {
    return template;
  } else {
    return template.replace(/\/$/, "");
  }
}
function parse(options) {
  let method = options.method.toUpperCase();
  let url = (options.url || "/").replace(/:([a-z]\w+)/g, "{$1}");
  let headers = Object.assign({}, options.headers);
  let body;
  let parameters = omit(options, [
    "method",
    "baseUrl",
    "url",
    "headers",
    "request",
    "mediaType"
  ]);
  const urlVariableNames = extractUrlVariableNames(url);
  url = parseUrl(url).expand(parameters);
  if (!/^http/.test(url)) {
    url = options.baseUrl + url;
  }
  const omittedParameters = Object.keys(options).filter((option) => urlVariableNames.includes(option)).concat("baseUrl");
  const remainingParameters = omit(parameters, omittedParameters);
  const isBinaryRequest = /application\/octet-stream/i.test(headers.accept);
  if (!isBinaryRequest) {
    if (options.mediaType.format) {
      headers.accept = headers.accept.split(/,/).map(
        (format) => format.replace(
          /application\/vnd(\.\w+)(\.v3)?(\.\w+)?(\+json)?$/,
          `application/vnd$1$2.${options.mediaType.format}`
        )
      ).join(",");
    }
    if (url.endsWith("/graphql")) {
      if (options.mediaType.previews?.length) {
        const previewsFromAcceptHeader = headers.accept.match(/(?<![\w-])[\w-]+(?=-preview)/g) || [];
        headers.accept = previewsFromAcceptHeader.concat(options.mediaType.previews).map((preview) => {
          const format = options.mediaType.format ? `.${options.mediaType.format}` : "+json";
          return `application/vnd.github.${preview}-preview${format}`;
        }).join(",");
      }
    }
  }
  if (["GET", "HEAD"].includes(method)) {
    url = addQueryParameters(url, remainingParameters);
  } else {
    if ("data" in remainingParameters) {
      body = remainingParameters.data;
    } else {
      if (Object.keys(remainingParameters).length) {
        body = remainingParameters;
      }
    }
  }
  if (!headers["content-type"] && typeof body !== "undefined") {
    headers["content-type"] = "application/json; charset=utf-8";
  }
  if (["PATCH", "PUT"].includes(method) && typeof body === "undefined") {
    body = "";
  }
  return Object.assign(
    { method, url, headers },
    typeof body !== "undefined" ? { body } : null,
    options.request ? { request: options.request } : null
  );
}
function endpointWithDefaults(defaults, route, options) {
  return parse(merge(defaults, route, options));
}
function withDefaults(oldDefaults, newDefaults) {
  const DEFAULTS2 = merge(oldDefaults, newDefaults);
  const endpoint2 = endpointWithDefaults.bind(null, DEFAULTS2);
  return Object.assign(endpoint2, {
    DEFAULTS: DEFAULTS2,
    defaults: withDefaults.bind(null, DEFAULTS2),
    merge: merge.bind(null, DEFAULTS2),
    parse
  });
}
var endpoint = withDefaults(null, DEFAULTS);

// node_modules/@octokit/request/dist-bundle/index.js
var import_content_type = __toESM(require_dist(), 1);

// node_modules/json-with-bigint/json-with-bigint.js
var intRegex = /^-?\d+$/;
var noiseValue = /^-?\d+n+$/;
var originalStringify = JSON.stringify;
var originalParse = JSON.parse;
var customFormat = /^-?\d+n$/;
var bigIntsStringify = /([\[:])?"(-?\d+)n"($|\s*[,\}\]])/g;
var noiseStringify = /([\[:])?("-?\d+n+)n("$|"\s*[,\}\]])/g;
var isUnstringifiable = (val) => val === void 0 || typeof val === "function" || typeof val === "symbol";
var isRawJSON = (val) => val !== null && typeof val === "object" && val.constructor && val.constructor.name === "RawJSON";
var stringifyIteratively = (rootValue, replacer, spaceParam) => {
  let space = "";
  if (typeof spaceParam === "number") {
    space = " ".repeat(Math.min(10, Math.max(0, Math.floor(spaceParam))));
  } else if (typeof spaceParam === "string") {
    space = spaceParam.slice(0, 10);
  }
  const isFunctionReplacer = typeof replacer === "function";
  const propertyList = Array.isArray(replacer) ? new Set(replacer.map(String)) : null;
  const prepareVal = (parent, key, val) => {
    const isObject = val !== null && typeof val === "object";
    const hasToJSON = isObject && typeof val.toJSON === "function";
    if (hasToJSON) {
      val = val.toJSON(key);
    }
    const isNoise = typeof val === "string" && noiseValue.test(val);
    if (isNoise) return val + "n";
    const isBigInt = typeof val === "bigint";
    if (isBigInt) {
      const supportsRawJSON = "rawJSON" in JSON;
      if (supportsRawJSON) return JSON.rawJSON(val.toString());
      return val.toString() + "n";
    }
    if (isFunctionReplacer) {
      val = replacer.call(parent, key, val);
    }
    const isPostReplacerObject = val !== null && typeof val === "object";
    if (isPostReplacerObject) {
      const isPrimitiveWrapper = val instanceof Number || val instanceof String || val instanceof Boolean;
      if (isPrimitiveWrapper) {
        val = val.valueOf();
      }
    }
    return val;
  };
  const rootProcessed = prepareVal({ "": rootValue }, "", rootValue);
  if (isUnstringifiable(rootProcessed)) {
    return void 0;
  }
  const isRootPrimitive = rootProcessed === null || typeof rootProcessed !== "object";
  const isRootNativeRawJSON = isRawJSON(rootProcessed);
  if (isRootPrimitive || isRootNativeRawJSON) {
    return originalStringify(rootProcessed);
  }
  const chunks = [];
  let level = 0;
  const stack = [
    {
      parent: { "": rootProcessed },
      key: "",
      val: rootProcessed,
      isArray: Array.isArray(rootProcessed),
      keys: Array.isArray(rootProcessed) ? null : Object.keys(rootProcessed),
      index: 0,
      first: true
    }
  ];
  const visited = new WeakSet([rootProcessed]);
  while (stack.length > 0) {
    const node = stack[stack.length - 1];
    if (node.index === 0) {
      chunks.push(node.isArray ? "[" : "{");
      level++;
    }
    let isDone = false;
    if (node.isArray) {
      if (node.index < node.val.length) {
        if (!node.first) chunks.push(",");
        if (space) chunks.push("\n" + space.repeat(level));
        const childRaw = node.val[node.index];
        const childVal = prepareVal(node.val, String(node.index), childRaw);
        if (isUnstringifiable(childVal)) {
          chunks.push("null");
          node.first = false;
          node.index++;
        } else {
          const isComplexObject = childVal !== null && typeof childVal === "object";
          const isNativeRaw = isRawJSON(childVal);
          if (isComplexObject && !isNativeRaw) {
            if (visited.has(childVal)) {
              throw new TypeError("Converting circular structure to JSON");
            }
            visited.add(childVal);
            stack.push({
              parent: node.val,
              key: String(node.index),
              val: childVal,
              isArray: Array.isArray(childVal),
              keys: Array.isArray(childVal) ? null : Object.keys(childVal),
              index: 0,
              first: true
            });
            node.first = false;
            node.index++;
          } else {
            chunks.push(originalStringify(childVal));
            node.first = false;
            node.index++;
          }
        }
      } else {
        isDone = true;
      }
    } else {
      while (node.index < node.keys.length) {
        const k = node.keys[node.index++];
        const isFilteredOutByArray = propertyList && !propertyList.has(k);
        if (isFilteredOutByArray) continue;
        const childRaw = node.val[k];
        const childVal = prepareVal(node.val, k, childRaw);
        if (isUnstringifiable(childVal)) continue;
        if (!node.first) chunks.push(",");
        if (space) {
          chunks.push("\n" + space.repeat(level) + originalStringify(k) + ": ");
        } else {
          chunks.push(originalStringify(k) + ":");
        }
        const isComplexObject = childVal !== null && typeof childVal === "object";
        const isNativeRaw = isRawJSON(childVal);
        if (isComplexObject && !isNativeRaw) {
          if (visited.has(childVal)) {
            throw new TypeError("Converting circular structure to JSON");
          }
          visited.add(childVal);
          stack.push({
            parent: node.val,
            key: k,
            val: childVal,
            isArray: Array.isArray(childVal),
            keys: Array.isArray(childVal) ? null : Object.keys(childVal),
            index: 0,
            first: true
          });
          node.first = false;
          break;
        } else {
          chunks.push(originalStringify(childVal));
          node.first = false;
        }
      }
      const isNodeFullyProcessed = node.index >= node.keys.length && stack[stack.length - 1] === node;
      if (isNodeFullyProcessed) {
        isDone = true;
      }
    }
    if (isDone) {
      level--;
      if (!node.first && space) chunks.push("\n" + space.repeat(level));
      chunks.push(node.isArray ? "]" : "}");
      visited.delete(node.val);
      stack.pop();
    }
  }
  return chunks.join("");
};
var JSONStringify = (value, replacer, space) => {
  try {
    const supportsRawJSON = "rawJSON" in JSON;
    if (supportsRawJSON) {
      return originalStringify(
        value,
        (key, val) => {
          if (typeof val === "bigint") return JSON.rawJSON(val.toString());
          const hasFunctionReplacer = typeof replacer === "function";
          if (hasFunctionReplacer) return replacer(key, val);
          const isKeyInArrayReplacer = Array.isArray(replacer) && replacer.includes(key);
          if (isKeyInArrayReplacer) return val;
          return val;
        },
        space
      );
    }
    if (!value) return originalStringify(value, replacer, space);
    const convertedToCustomJSON = originalStringify(
      value,
      (key, val) => {
        const isNoise = typeof val === "string" && noiseValue.test(val);
        if (isNoise) return val.toString() + "n";
        if (typeof val === "bigint") return val.toString() + "n";
        const hasFunctionReplacer = typeof replacer === "function";
        if (hasFunctionReplacer) return replacer(key, val);
        const isKeyInArrayReplacer = Array.isArray(replacer) && replacer.includes(key);
        if (isKeyInArrayReplacer) return val;
        return val;
      },
      space
    );
    const processedJSON = convertedToCustomJSON.replace(
      bigIntsStringify,
      "$1$2$3"
    );
    const denoisedJSON = processedJSON.replace(noiseStringify, "$1$2$3");
    return denoisedJSON;
  } catch (error) {
    if (error instanceof RangeError) {
      const convertedJSON = stringifyIteratively(value, replacer, space);
      if (convertedJSON === void 0) return void 0;
      const supportsRawJSON = "rawJSON" in JSON;
      if (supportsRawJSON) return convertedJSON;
      const processedJSON = convertedJSON.replace(bigIntsStringify, "$1$2$3");
      return processedJSON.replace(noiseStringify, "$1$2$3");
    }
    throw error;
  }
};
var featureCache = /* @__PURE__ */ new Map();
var isContextSourceSupported = () => {
  const parseFingerprint = JSON.parse.toString();
  if (featureCache.has(parseFingerprint)) {
    return featureCache.get(parseFingerprint);
  }
  try {
    const result = JSON.parse(
      "1",
      (_, __, context) => !!context?.source && context.source === "1"
    );
    featureCache.set(parseFingerprint, result);
    return result;
  } catch {
    featureCache.set(parseFingerprint, false);
    return false;
  }
};
var convertMarkedBigIntsReviver = (key, value, context, userReviver) => {
  const isCustomFormatBigInt = typeof value === "string" && customFormat.test(value);
  if (isCustomFormatBigInt) return BigInt(value.slice(0, -1));
  const isNoiseValue = typeof value === "string" && noiseValue.test(value);
  if (isNoiseValue) return value.slice(0, -1);
  const hasUserReviver = typeof userReviver === "function";
  if (!hasUserReviver) return value;
  return userReviver(key, value, context);
};
var JSONParseV2 = (text, reviver) => {
  return JSON.parse(text, (key, value, context) => {
    const isNumber = typeof value === "number";
    const isOutOfBounds = value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER;
    const isBigNumber = isNumber && isOutOfBounds;
    const isInt = context && intRegex.test(context.source);
    const isBigInt = isBigNumber && isInt;
    if (isBigInt) return BigInt(context.source);
    const hasCustomReviver = typeof reviver === "function";
    if (!hasCustomReviver) return value;
    return reviver(key, value, context);
  });
};
var MAX_INT = Number.MAX_SAFE_INTEGER.toString();
var MAX_DIGITS = MAX_INT.length;
var stringsOrLargeNumbers = /"(?:\\.|[^"])*"|-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/g;
var noiseValueWithQuotes = /^"-?\d+n+"$/;
var applyReviverIteratively = (parsed, userReviver) => {
  const rootHolder = { "": parsed };
  const stack = [{ parent: rootHolder, key: "", visited: false }];
  while (stack.length > 0) {
    const node = stack[stack.length - 1];
    if (!node.visited) {
      node.visited = true;
      const value = node.parent[node.key];
      const isComplexObject = value !== null && typeof value === "object";
      if (isComplexObject) {
        const keys = Object.keys(value);
        for (let i = keys.length - 1; i >= 0; i--) {
          stack.push({ parent: value, key: keys[i], visited: false });
        }
      }
    } else {
      const { parent, key } = node;
      let value = parent[key];
      if (typeof value === "string") {
        const isCustomFormatBigInt = customFormat.test(value);
        if (isCustomFormatBigInt) {
          value = BigInt(value.slice(0, -1));
        } else {
          const isNoise = noiseValue.test(value);
          if (isNoise) value = value.slice(0, -1);
        }
      }
      const hasUserReviver = typeof userReviver === "function";
      if (hasUserReviver) {
        value = userReviver.call(parent, key, value);
      }
      const isDeleted = value === void 0;
      if (isDeleted) {
        delete parent[key];
      } else {
        parent[key] = value;
      }
      stack.pop();
    }
  }
  return rootHolder[""];
};
var serializeBigInts = (text) => {
  return text.replace(
    stringsOrLargeNumbers,
    (match, digits, fractional, exponential) => {
      const isString = match[0] === '"';
      const isNoise = isString && noiseValueWithQuotes.test(match);
      if (isNoise) return match.substring(0, match.length - 1) + 'n"';
      const hasFractionalOrExponential = fractional || exponential;
      const isLessThanMaxSafeInt = digits && (digits.length < MAX_DIGITS || digits.length === MAX_DIGITS && digits <= MAX_INT);
      const isStandardValue = isString || hasFractionalOrExponential || isLessThanMaxSafeInt;
      if (isStandardValue) return match;
      return '"' + match + 'n"';
    }
  );
};
var JSONParse = (text, reviver) => {
  if (!text) return originalParse(text, reviver);
  try {
    if (isContextSourceSupported()) return JSONParseV2(text, reviver);
    const serializedData = serializeBigInts(text);
    return originalParse(
      serializedData,
      (key, value, context) => convertMarkedBigIntsReviver(key, value, context, reviver)
    );
  } catch (error) {
    if (error instanceof RangeError) {
      const serializedData = serializeBigInts(text);
      const parsed = originalParse(serializedData);
      return applyReviverIteratively(parsed, reviver);
    }
    throw error;
  }
};

// node_modules/@octokit/request-error/dist-src/index.js
var RequestError = class extends Error {
  name;
  /**
   * http status code
   */
  status;
  /**
   * Request options that lead to the error.
   */
  request;
  /**
   * Response object if a response was received
   */
  response;
  constructor(message, statusCode, options) {
    super(message, { cause: options.cause });
    this.name = "HttpError";
    this.status = Number.parseInt(statusCode);
    if (Number.isNaN(this.status)) {
      this.status = 0;
    }
    if ("response" in options) {
      this.response = options.response;
    }
    const requestCopy = Object.assign({}, options.request);
    if (options.request.headers.authorization) {
      requestCopy.headers = Object.assign({}, options.request.headers, {
        authorization: options.request.headers.authorization.replace(
          /(?<! ) .*$/,
          " [REDACTED]"
        )
      });
    }
    requestCopy.url = requestCopy.url.replace(/\bclient_secret=\w+/g, "client_secret=[REDACTED]").replace(/\baccess_token=\w+/g, "access_token=[REDACTED]");
    this.request = requestCopy;
  }
};

// node_modules/@octokit/request/dist-bundle/index.js
var VERSION2 = "10.0.11";
var defaults_default = {
  headers: {
    "user-agent": `octokit-request.js/${VERSION2} ${getUserAgent()}`
  }
};
function isPlainObject2(value) {
  if (typeof value !== "object" || value === null) return false;
  if (Object.prototype.toString.call(value) !== "[object Object]") return false;
  const proto = Object.getPrototypeOf(value);
  if (proto === null) return true;
  const Ctor = Object.prototype.hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof Ctor === "function" && Ctor instanceof Ctor && Function.prototype.call(Ctor) === Function.prototype.call(value);
}
var noop = () => "";
async function fetchWrapper(requestOptions) {
  const fetch2 = requestOptions.request?.fetch || globalThis.fetch;
  if (!fetch2) {
    throw new Error(
      "fetch is not set. Please pass a fetch implementation as new Octokit({ request: { fetch }}). Learn more at https://github.com/octokit/octokit.js/#fetch-missing"
    );
  }
  const log = requestOptions.request?.log || console;
  const parseSuccessResponseBody = requestOptions.request?.parseSuccessResponseBody !== false;
  const body = isPlainObject2(requestOptions.body) || Array.isArray(requestOptions.body) ? JSONStringify(requestOptions.body) : requestOptions.body;
  const requestHeaders = Object.fromEntries(
    Object.entries(requestOptions.headers).map(([name, value]) => [
      name,
      String(value)
    ])
  );
  let fetchResponse;
  try {
    fetchResponse = await fetch2(requestOptions.url, {
      method: requestOptions.method,
      body,
      redirect: requestOptions.request?.redirect,
      headers: requestHeaders,
      signal: requestOptions.request?.signal,
      // duplex must be set if request.body is ReadableStream or Async Iterables.
      // See https://fetch.spec.whatwg.org/#dom-requestinit-duplex.
      ...requestOptions.body && { duplex: "half" }
    });
  } catch (error) {
    let message = "Unknown Error";
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        error.status = 500;
        throw error;
      }
      message = error.message;
      if (error.name === "TypeError" && "cause" in error) {
        if (error.cause instanceof Error) {
          message = error.cause.message;
        } else if (typeof error.cause === "string") {
          message = error.cause;
        }
      }
    }
    const requestError = new RequestError(message, 500, {
      request: requestOptions
    });
    requestError.cause = error;
    throw requestError;
  }
  const status = fetchResponse.status;
  const url = fetchResponse.url;
  const responseHeaders = {};
  for (const [key, value] of fetchResponse.headers) {
    responseHeaders[key] = value;
  }
  const octokitResponse = {
    url,
    status,
    headers: responseHeaders,
    data: ""
  };
  if ("deprecation" in responseHeaders) {
    const matches = responseHeaders.link && responseHeaders.link.match(/<([^<>]+)>; rel="deprecation"/);
    const deprecationLink = matches && matches.pop();
    log.warn(
      `[@octokit/request] "${requestOptions.method} ${requestOptions.url}" is deprecated. It is scheduled to be removed on ${responseHeaders.sunset}${deprecationLink ? `. See ${deprecationLink}` : ""}`
    );
  }
  if (status === 204 || status === 205) {
    return octokitResponse;
  }
  if (requestOptions.method === "HEAD") {
    if (status < 400) {
      return octokitResponse;
    }
    throw new RequestError(fetchResponse.statusText, status, {
      response: octokitResponse,
      request: requestOptions
    });
  }
  if (status === 304) {
    octokitResponse.data = await getResponseData(fetchResponse);
    throw new RequestError("Not modified", status, {
      response: octokitResponse,
      request: requestOptions
    });
  }
  if (status >= 400) {
    octokitResponse.data = await getResponseData(fetchResponse);
    throw new RequestError(toErrorMessage(octokitResponse.data), status, {
      response: octokitResponse,
      request: requestOptions
    });
  }
  octokitResponse.data = parseSuccessResponseBody ? await getResponseData(fetchResponse) : fetchResponse.body;
  return octokitResponse;
}
async function getResponseData(response) {
  const contentType = response.headers.get("content-type");
  if (!contentType) {
    return response.text().catch(noop);
  }
  const mimetype = (0, import_content_type.parse)(contentType);
  if (isJSONResponse(mimetype)) {
    let text = "";
    try {
      text = await response.text();
      return JSONParse(text);
    } catch (err) {
      return text;
    }
  } else if (mimetype.type.startsWith("text/") || mimetype.parameters.charset?.toLowerCase() === "utf-8") {
    return response.text().catch(noop);
  } else {
    return response.arrayBuffer().catch(
      /* v8 ignore next -- @preserve */
      () => new ArrayBuffer(0)
    );
  }
}
function isJSONResponse(mimetype) {
  return mimetype.type === "application/json" || mimetype.type === "application/scim+json";
}
function toErrorMessage(data) {
  if (typeof data === "string") {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return "Unknown error";
  }
  if (typeof data === "object" && data !== null && "message" in data) {
    const objectData = data;
    const suffix = "documentation_url" in objectData ? ` - ${objectData.documentation_url}` : "";
    return Array.isArray(objectData.errors) ? `${objectData.message}: ${objectData.errors.map((v) => JSON.stringify(v)).join(", ")}${suffix}` : `${objectData.message}${suffix}`;
  }
  return `Unknown error: ${JSON.stringify(data)}`;
}
function withDefaults2(oldEndpoint, newDefaults) {
  const endpoint2 = oldEndpoint.defaults(newDefaults);
  const newApi = function(route, parameters) {
    const endpointOptions = endpoint2.merge(route, parameters);
    if (!endpointOptions.request || !endpointOptions.request.hook) {
      return fetchWrapper(endpoint2.parse(endpointOptions));
    }
    const request2 = (route2, parameters2) => {
      return fetchWrapper(
        endpoint2.parse(endpoint2.merge(route2, parameters2))
      );
    };
    Object.assign(request2, {
      endpoint: endpoint2,
      defaults: withDefaults2.bind(null, endpoint2)
    });
    return endpointOptions.request.hook(request2, endpointOptions);
  };
  return Object.assign(newApi, {
    endpoint: endpoint2,
    defaults: withDefaults2.bind(null, endpoint2)
  });
}
var request = withDefaults2(endpoint, defaults_default);

// node_modules/@octokit/graphql/dist-bundle/index.js
var VERSION3 = "0.0.0-development";
function _buildMessageForResponseErrors(data) {
  return `Request failed due to following response errors:
` + data.errors.map((e) => ` - ${e.message}`).join("\n");
}
var GraphqlResponseError = class extends Error {
  constructor(request2, headers, response) {
    super(_buildMessageForResponseErrors(response));
    this.request = request2;
    this.headers = headers;
    this.response = response;
    this.errors = response.errors;
    this.data = response.data;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  name = "GraphqlResponseError";
  errors;
  data;
};
var NON_VARIABLE_OPTIONS = [
  "method",
  "baseUrl",
  "url",
  "headers",
  "request",
  "query",
  "mediaType",
  "operationName"
];
var FORBIDDEN_VARIABLE_OPTIONS = ["query", "method", "url"];
var GHES_V3_SUFFIX_REGEX = /\/api\/v3\/?$/;
function graphql(request2, query, options) {
  if (options) {
    if (typeof query === "string" && "query" in options) {
      return Promise.reject(
        new Error(`[@octokit/graphql] "query" cannot be used as variable name`)
      );
    }
    for (const key in options) {
      if (!FORBIDDEN_VARIABLE_OPTIONS.includes(key)) continue;
      return Promise.reject(
        new Error(
          `[@octokit/graphql] "${key}" cannot be used as variable name`
        )
      );
    }
  }
  const parsedOptions = typeof query === "string" ? Object.assign({ query }, options) : query;
  const requestOptions = Object.keys(
    parsedOptions
  ).reduce((result, key) => {
    if (NON_VARIABLE_OPTIONS.includes(key)) {
      result[key] = parsedOptions[key];
      return result;
    }
    if (!result.variables) {
      result.variables = {};
    }
    result.variables[key] = parsedOptions[key];
    return result;
  }, {});
  const baseUrl = parsedOptions.baseUrl || request2.endpoint.DEFAULTS.baseUrl;
  if (GHES_V3_SUFFIX_REGEX.test(baseUrl)) {
    requestOptions.url = baseUrl.replace(GHES_V3_SUFFIX_REGEX, "/api/graphql");
  }
  return request2(requestOptions).then((response) => {
    if (response.data.errors) {
      const headers = {};
      for (const key of Object.keys(response.headers)) {
        headers[key] = response.headers[key];
      }
      throw new GraphqlResponseError(
        requestOptions,
        headers,
        response.data
      );
    }
    return response.data.data;
  });
}
function withDefaults3(request2, newDefaults) {
  const newRequest = request2.defaults(newDefaults);
  const newApi = (query, options) => {
    return graphql(newRequest, query, options);
  };
  return Object.assign(newApi, {
    defaults: withDefaults3.bind(null, newRequest),
    endpoint: newRequest.endpoint
  });
}
var graphql2 = withDefaults3(request, {
  headers: {
    "user-agent": `octokit-graphql.js/${VERSION3} ${getUserAgent()}`
  },
  method: "POST",
  url: "/graphql"
});
function withCustomRequest(customRequest) {
  return withDefaults3(customRequest, {
    method: "POST",
    url: "/graphql"
  });
}

// node_modules/@octokit/auth-token/dist-bundle/index.js
var b64url = "(?:[a-zA-Z0-9_-]+)";
var sep = "\\.";
var jwtRE = new RegExp(`^${b64url}${sep}${b64url}${sep}${b64url}$`);
var isJWT = jwtRE.test.bind(jwtRE);
async function auth(token) {
  const isApp = isJWT(token);
  const isInstallation = token.startsWith("v1.") || token.startsWith("ghs_");
  const isUserToServer = token.startsWith("ghu_");
  const tokenType = isApp ? "app" : isInstallation ? "installation" : isUserToServer ? "user-to-server" : "oauth";
  return {
    type: "token",
    token,
    tokenType
  };
}
function withAuthorizationPrefix(token) {
  if (token.split(/\./).length === 3) {
    return `bearer ${token}`;
  }
  return `token ${token}`;
}
async function hook(token, request2, route, parameters) {
  const endpoint2 = request2.endpoint.merge(
    route,
    parameters
  );
  endpoint2.headers.authorization = withAuthorizationPrefix(token);
  return request2(endpoint2);
}
var createTokenAuth = function createTokenAuth2(token) {
  if (!token) {
    throw new Error("[@octokit/auth-token] No token passed to createTokenAuth");
  }
  if (typeof token !== "string") {
    throw new Error(
      "[@octokit/auth-token] Token passed to createTokenAuth is not a string"
    );
  }
  token = token.replace(/^(token|bearer) +/i, "");
  return Object.assign(auth.bind(null, token), {
    hook: hook.bind(null, token)
  });
};

// node_modules/@octokit/core/dist-src/version.js
var VERSION4 = "7.0.6";

// node_modules/@octokit/core/dist-src/index.js
var noop2 = () => {
};
var consoleWarn = console.warn.bind(console);
var consoleError = console.error.bind(console);
function createLogger(logger = {}) {
  if (typeof logger.debug !== "function") {
    logger.debug = noop2;
  }
  if (typeof logger.info !== "function") {
    logger.info = noop2;
  }
  if (typeof logger.warn !== "function") {
    logger.warn = consoleWarn;
  }
  if (typeof logger.error !== "function") {
    logger.error = consoleError;
  }
  return logger;
}
var userAgentTrail = `octokit-core.js/${VERSION4} ${getUserAgent()}`;
var Octokit = class {
  static VERSION = VERSION4;
  static defaults(defaults) {
    const OctokitWithDefaults = class extends this {
      constructor(...args) {
        const options = args[0] || {};
        if (typeof defaults === "function") {
          super(defaults(options));
          return;
        }
        super(
          Object.assign(
            {},
            defaults,
            options,
            options.userAgent && defaults.userAgent ? {
              userAgent: `${options.userAgent} ${defaults.userAgent}`
            } : null
          )
        );
      }
    };
    return OctokitWithDefaults;
  }
  static plugins = [];
  /**
   * Attach a plugin (or many) to your Octokit instance.
   *
   * @example
   * const API = Octokit.plugin(plugin1, plugin2, plugin3, ...)
   */
  static plugin(...newPlugins) {
    const currentPlugins = this.plugins;
    const NewOctokit = class extends this {
      static plugins = currentPlugins.concat(
        newPlugins.filter((plugin) => !currentPlugins.includes(plugin))
      );
    };
    return NewOctokit;
  }
  constructor(options = {}) {
    const hook2 = new before_after_hook_default.Collection();
    const requestDefaults = {
      baseUrl: request.endpoint.DEFAULTS.baseUrl,
      headers: {},
      request: Object.assign({}, options.request, {
        // @ts-ignore internal usage only, no need to type
        hook: hook2.bind(null, "request")
      }),
      mediaType: {
        previews: [],
        format: ""
      }
    };
    requestDefaults.headers["user-agent"] = options.userAgent ? `${options.userAgent} ${userAgentTrail}` : userAgentTrail;
    if (options.baseUrl) {
      requestDefaults.baseUrl = options.baseUrl;
    }
    if (options.previews) {
      requestDefaults.mediaType.previews = options.previews;
    }
    if (options.timeZone) {
      requestDefaults.headers["time-zone"] = options.timeZone;
    }
    this.request = request.defaults(requestDefaults);
    this.graphql = withCustomRequest(this.request).defaults(requestDefaults);
    this.log = createLogger(options.log);
    this.hook = hook2;
    if (!options.authStrategy) {
      if (!options.auth) {
        this.auth = async () => ({
          type: "unauthenticated"
        });
      } else {
        const auth2 = createTokenAuth(options.auth);
        hook2.wrap("request", auth2.hook);
        this.auth = auth2;
      }
    } else {
      const { authStrategy, ...otherOptions } = options;
      const auth2 = authStrategy(
        Object.assign(
          {
            request: this.request,
            log: this.log,
            // we pass the current octokit instance as well as its constructor options
            // to allow for authentication strategies that return a new octokit instance
            // that shares the same internal state as the current one. The original
            // requirement for this was the "event-octokit" authentication strategy
            // of https://github.com/probot/octokit-auth-probot.
            octokit: this,
            octokitOptions: otherOptions
          },
          options.auth
        )
      );
      hook2.wrap("request", auth2.hook);
      this.auth = auth2;
    }
    const classConstructor = this.constructor;
    for (let i = 0; i < classConstructor.plugins.length; ++i) {
      Object.assign(this, classConstructor.plugins[i](this, options));
    }
  }
  // assigned during constructor
  request;
  graphql;
  log;
  hook;
  // TODO: type `octokit.auth` based on passed options.authStrategy
  auth;
};

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/version.js
var VERSION5 = "17.0.0";

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/generated/endpoints.js
var Endpoints = {
  actions: {
    addCustomLabelsToSelfHostedRunnerForOrg: [
      "POST /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    addCustomLabelsToSelfHostedRunnerForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    addRepoAccessToSelfHostedRunnerGroupInOrg: [
      "PUT /orgs/{org}/actions/runner-groups/{runner_group_id}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgVariable: [
      "PUT /orgs/{org}/actions/variables/{name}/repositories/{repository_id}"
    ],
    approveWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/approve"
    ],
    cancelWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel"
    ],
    createEnvironmentVariable: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/variables"
    ],
    createHostedRunnerForOrg: ["POST /orgs/{org}/actions/hosted-runners"],
    createOrUpdateEnvironmentSecret: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}"
    ],
    createOrUpdateOrgSecret: ["PUT /orgs/{org}/actions/secrets/{secret_name}"],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}"
    ],
    createOrgVariable: ["POST /orgs/{org}/actions/variables"],
    createRegistrationTokenForOrg: [
      "POST /orgs/{org}/actions/runners/registration-token"
    ],
    createRegistrationTokenForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/registration-token"
    ],
    createRemoveTokenForOrg: ["POST /orgs/{org}/actions/runners/remove-token"],
    createRemoveTokenForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/remove-token"
    ],
    createRepoVariable: ["POST /repos/{owner}/{repo}/actions/variables"],
    createWorkflowDispatch: [
      "POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches"
    ],
    deleteActionsCacheById: [
      "DELETE /repos/{owner}/{repo}/actions/caches/{cache_id}"
    ],
    deleteActionsCacheByKey: [
      "DELETE /repos/{owner}/{repo}/actions/caches{?key,ref}"
    ],
    deleteArtifact: [
      "DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}"
    ],
    deleteCustomImageFromOrg: [
      "DELETE /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}"
    ],
    deleteCustomImageVersionFromOrg: [
      "DELETE /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions/{version}"
    ],
    deleteEnvironmentSecret: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}"
    ],
    deleteEnvironmentVariable: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}"
    ],
    deleteHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/hosted-runners/{hosted_runner_id}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/actions/secrets/{secret_name}"],
    deleteOrgVariable: ["DELETE /orgs/{org}/actions/variables/{name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}"
    ],
    deleteRepoVariable: [
      "DELETE /repos/{owner}/{repo}/actions/variables/{name}"
    ],
    deleteSelfHostedRunnerFromOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}"
    ],
    deleteSelfHostedRunnerFromRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}"
    ],
    deleteWorkflowRun: ["DELETE /repos/{owner}/{repo}/actions/runs/{run_id}"],
    deleteWorkflowRunLogs: [
      "DELETE /repos/{owner}/{repo}/actions/runs/{run_id}/logs"
    ],
    disableSelectedRepositoryGithubActionsOrganization: [
      "DELETE /orgs/{org}/actions/permissions/repositories/{repository_id}"
    ],
    disableWorkflow: [
      "PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/disable"
    ],
    downloadArtifact: [
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}"
    ],
    downloadJobLogsForWorkflowRun: [
      "GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs"
    ],
    downloadWorkflowRunAttemptLogs: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/logs"
    ],
    downloadWorkflowRunLogs: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs"
    ],
    enableSelectedRepositoryGithubActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/repositories/{repository_id}"
    ],
    enableWorkflow: [
      "PUT /repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable"
    ],
    forceCancelWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/force-cancel"
    ],
    generateRunnerJitconfigForOrg: [
      "POST /orgs/{org}/actions/runners/generate-jitconfig"
    ],
    generateRunnerJitconfigForRepo: [
      "POST /repos/{owner}/{repo}/actions/runners/generate-jitconfig"
    ],
    getActionsCacheList: ["GET /repos/{owner}/{repo}/actions/caches"],
    getActionsCacheUsage: ["GET /repos/{owner}/{repo}/actions/cache/usage"],
    getActionsCacheUsageByRepoForOrg: [
      "GET /orgs/{org}/actions/cache/usage-by-repository"
    ],
    getActionsCacheUsageForOrg: ["GET /orgs/{org}/actions/cache/usage"],
    getAllowedActionsOrganization: [
      "GET /orgs/{org}/actions/permissions/selected-actions"
    ],
    getAllowedActionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/selected-actions"
    ],
    getArtifact: ["GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}"],
    getCustomImageForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}"
    ],
    getCustomImageVersionForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions/{version}"
    ],
    getCustomOidcSubClaimForRepo: [
      "GET /repos/{owner}/{repo}/actions/oidc/customization/sub"
    ],
    getEnvironmentPublicKey: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/public-key"
    ],
    getEnvironmentSecret: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets/{secret_name}"
    ],
    getEnvironmentVariable: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}"
    ],
    getGithubActionsDefaultWorkflowPermissionsOrganization: [
      "GET /orgs/{org}/actions/permissions/workflow"
    ],
    getGithubActionsDefaultWorkflowPermissionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/workflow"
    ],
    getGithubActionsPermissionsOrganization: [
      "GET /orgs/{org}/actions/permissions"
    ],
    getGithubActionsPermissionsRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions"
    ],
    getHostedRunnerForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/{hosted_runner_id}"
    ],
    getHostedRunnersGithubOwnedImagesForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/images/github-owned"
    ],
    getHostedRunnersLimitsForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/limits"
    ],
    getHostedRunnersMachineSpecsForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/machine-sizes"
    ],
    getHostedRunnersPartnerImagesForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/images/partner"
    ],
    getHostedRunnersPlatformsForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/platforms"
    ],
    getJobForWorkflowRun: ["GET /repos/{owner}/{repo}/actions/jobs/{job_id}"],
    getOrgPublicKey: ["GET /orgs/{org}/actions/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/actions/secrets/{secret_name}"],
    getOrgVariable: ["GET /orgs/{org}/actions/variables/{name}"],
    getPendingDeploymentsForRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments"
    ],
    getRepoPermissions: [
      "GET /repos/{owner}/{repo}/actions/permissions",
      {},
      { renamed: ["actions", "getGithubActionsPermissionsRepository"] }
    ],
    getRepoPublicKey: ["GET /repos/{owner}/{repo}/actions/secrets/public-key"],
    getRepoSecret: ["GET /repos/{owner}/{repo}/actions/secrets/{secret_name}"],
    getRepoVariable: ["GET /repos/{owner}/{repo}/actions/variables/{name}"],
    getReviewsForRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/approvals"
    ],
    getSelfHostedRunnerForOrg: ["GET /orgs/{org}/actions/runners/{runner_id}"],
    getSelfHostedRunnerForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/{runner_id}"
    ],
    getWorkflow: ["GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}"],
    getWorkflowAccessToRepository: [
      "GET /repos/{owner}/{repo}/actions/permissions/access"
    ],
    getWorkflowRun: ["GET /repos/{owner}/{repo}/actions/runs/{run_id}"],
    getWorkflowRunAttempt: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}"
    ],
    getWorkflowRunUsage: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/timing"
    ],
    getWorkflowUsage: [
      "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/timing"
    ],
    listArtifactsForRepo: ["GET /repos/{owner}/{repo}/actions/artifacts"],
    listCustomImageVersionsForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/images/custom/{image_definition_id}/versions"
    ],
    listCustomImagesForOrg: [
      "GET /orgs/{org}/actions/hosted-runners/images/custom"
    ],
    listEnvironmentSecrets: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/secrets"
    ],
    listEnvironmentVariables: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/variables"
    ],
    listGithubHostedRunnersInGroupForOrg: [
      "GET /orgs/{org}/actions/runner-groups/{runner_group_id}/hosted-runners"
    ],
    listHostedRunnersForOrg: ["GET /orgs/{org}/actions/hosted-runners"],
    listJobsForWorkflowRun: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs"
    ],
    listJobsForWorkflowRunAttempt: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt_number}/jobs"
    ],
    listLabelsForSelfHostedRunnerForOrg: [
      "GET /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    listLabelsForSelfHostedRunnerForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    listOrgSecrets: ["GET /orgs/{org}/actions/secrets"],
    listOrgVariables: ["GET /orgs/{org}/actions/variables"],
    listRepoOrganizationSecrets: [
      "GET /repos/{owner}/{repo}/actions/organization-secrets"
    ],
    listRepoOrganizationVariables: [
      "GET /repos/{owner}/{repo}/actions/organization-variables"
    ],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/actions/secrets"],
    listRepoVariables: ["GET /repos/{owner}/{repo}/actions/variables"],
    listRepoWorkflows: ["GET /repos/{owner}/{repo}/actions/workflows"],
    listRunnerApplicationsForOrg: ["GET /orgs/{org}/actions/runners/downloads"],
    listRunnerApplicationsForRepo: [
      "GET /repos/{owner}/{repo}/actions/runners/downloads"
    ],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/actions/secrets/{secret_name}/repositories"
    ],
    listSelectedReposForOrgVariable: [
      "GET /orgs/{org}/actions/variables/{name}/repositories"
    ],
    listSelectedRepositoriesEnabledGithubActionsOrganization: [
      "GET /orgs/{org}/actions/permissions/repositories"
    ],
    listSelfHostedRunnersForOrg: ["GET /orgs/{org}/actions/runners"],
    listSelfHostedRunnersForRepo: ["GET /repos/{owner}/{repo}/actions/runners"],
    listWorkflowRunArtifacts: [
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts"
    ],
    listWorkflowRuns: [
      "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs"
    ],
    listWorkflowRunsForRepo: ["GET /repos/{owner}/{repo}/actions/runs"],
    reRunJobForWorkflowRun: [
      "POST /repos/{owner}/{repo}/actions/jobs/{job_id}/rerun"
    ],
    reRunWorkflow: ["POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun"],
    reRunWorkflowFailedJobs: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs"
    ],
    removeAllCustomLabelsFromSelfHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    removeAllCustomLabelsFromSelfHostedRunnerForRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    removeCustomLabelFromSelfHostedRunnerForOrg: [
      "DELETE /orgs/{org}/actions/runners/{runner_id}/labels/{name}"
    ],
    removeCustomLabelFromSelfHostedRunnerForRepo: [
      "DELETE /repos/{owner}/{repo}/actions/runners/{runner_id}/labels/{name}"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/actions/secrets/{secret_name}/repositories/{repository_id}"
    ],
    removeSelectedRepoFromOrgVariable: [
      "DELETE /orgs/{org}/actions/variables/{name}/repositories/{repository_id}"
    ],
    reviewCustomGatesForRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/deployment_protection_rule"
    ],
    reviewPendingDeploymentsForRun: [
      "POST /repos/{owner}/{repo}/actions/runs/{run_id}/pending_deployments"
    ],
    setAllowedActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/selected-actions"
    ],
    setAllowedActionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/selected-actions"
    ],
    setCustomLabelsForSelfHostedRunnerForOrg: [
      "PUT /orgs/{org}/actions/runners/{runner_id}/labels"
    ],
    setCustomLabelsForSelfHostedRunnerForRepo: [
      "PUT /repos/{owner}/{repo}/actions/runners/{runner_id}/labels"
    ],
    setCustomOidcSubClaimForRepo: [
      "PUT /repos/{owner}/{repo}/actions/oidc/customization/sub"
    ],
    setGithubActionsDefaultWorkflowPermissionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/workflow"
    ],
    setGithubActionsDefaultWorkflowPermissionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/workflow"
    ],
    setGithubActionsPermissionsOrganization: [
      "PUT /orgs/{org}/actions/permissions"
    ],
    setGithubActionsPermissionsRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/actions/secrets/{secret_name}/repositories"
    ],
    setSelectedReposForOrgVariable: [
      "PUT /orgs/{org}/actions/variables/{name}/repositories"
    ],
    setSelectedRepositoriesEnabledGithubActionsOrganization: [
      "PUT /orgs/{org}/actions/permissions/repositories"
    ],
    setWorkflowAccessToRepository: [
      "PUT /repos/{owner}/{repo}/actions/permissions/access"
    ],
    updateEnvironmentVariable: [
      "PATCH /repos/{owner}/{repo}/environments/{environment_name}/variables/{name}"
    ],
    updateHostedRunnerForOrg: [
      "PATCH /orgs/{org}/actions/hosted-runners/{hosted_runner_id}"
    ],
    updateOrgVariable: ["PATCH /orgs/{org}/actions/variables/{name}"],
    updateRepoVariable: [
      "PATCH /repos/{owner}/{repo}/actions/variables/{name}"
    ]
  },
  activity: {
    checkRepoIsStarredByAuthenticatedUser: ["GET /user/starred/{owner}/{repo}"],
    deleteRepoSubscription: ["DELETE /repos/{owner}/{repo}/subscription"],
    deleteThreadSubscription: [
      "DELETE /notifications/threads/{thread_id}/subscription"
    ],
    getFeeds: ["GET /feeds"],
    getRepoSubscription: ["GET /repos/{owner}/{repo}/subscription"],
    getThread: ["GET /notifications/threads/{thread_id}"],
    getThreadSubscriptionForAuthenticatedUser: [
      "GET /notifications/threads/{thread_id}/subscription"
    ],
    listEventsForAuthenticatedUser: ["GET /users/{username}/events"],
    listNotificationsForAuthenticatedUser: ["GET /notifications"],
    listOrgEventsForAuthenticatedUser: [
      "GET /users/{username}/events/orgs/{org}"
    ],
    listPublicEvents: ["GET /events"],
    listPublicEventsForRepoNetwork: ["GET /networks/{owner}/{repo}/events"],
    listPublicEventsForUser: ["GET /users/{username}/events/public"],
    listPublicOrgEvents: ["GET /orgs/{org}/events"],
    listReceivedEventsForUser: ["GET /users/{username}/received_events"],
    listReceivedPublicEventsForUser: [
      "GET /users/{username}/received_events/public"
    ],
    listRepoEvents: ["GET /repos/{owner}/{repo}/events"],
    listRepoNotificationsForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/notifications"
    ],
    listReposStarredByAuthenticatedUser: ["GET /user/starred"],
    listReposStarredByUser: ["GET /users/{username}/starred"],
    listReposWatchedByUser: ["GET /users/{username}/subscriptions"],
    listStargazersForRepo: ["GET /repos/{owner}/{repo}/stargazers"],
    listWatchedReposForAuthenticatedUser: ["GET /user/subscriptions"],
    listWatchersForRepo: ["GET /repos/{owner}/{repo}/subscribers"],
    markNotificationsAsRead: ["PUT /notifications"],
    markRepoNotificationsAsRead: ["PUT /repos/{owner}/{repo}/notifications"],
    markThreadAsDone: ["DELETE /notifications/threads/{thread_id}"],
    markThreadAsRead: ["PATCH /notifications/threads/{thread_id}"],
    setRepoSubscription: ["PUT /repos/{owner}/{repo}/subscription"],
    setThreadSubscription: [
      "PUT /notifications/threads/{thread_id}/subscription"
    ],
    starRepoForAuthenticatedUser: ["PUT /user/starred/{owner}/{repo}"],
    unstarRepoForAuthenticatedUser: ["DELETE /user/starred/{owner}/{repo}"]
  },
  apps: {
    addRepoToInstallation: [
      "PUT /user/installations/{installation_id}/repositories/{repository_id}",
      {},
      { renamed: ["apps", "addRepoToInstallationForAuthenticatedUser"] }
    ],
    addRepoToInstallationForAuthenticatedUser: [
      "PUT /user/installations/{installation_id}/repositories/{repository_id}"
    ],
    checkToken: ["POST /applications/{client_id}/token"],
    createFromManifest: ["POST /app-manifests/{code}/conversions"],
    createInstallationAccessToken: [
      "POST /app/installations/{installation_id}/access_tokens"
    ],
    deleteAuthorization: ["DELETE /applications/{client_id}/grant"],
    deleteInstallation: ["DELETE /app/installations/{installation_id}"],
    deleteToken: ["DELETE /applications/{client_id}/token"],
    getAuthenticated: ["GET /app"],
    getBySlug: ["GET /apps/{app_slug}"],
    getInstallation: ["GET /app/installations/{installation_id}"],
    getOrgInstallation: ["GET /orgs/{org}/installation"],
    getRepoInstallation: ["GET /repos/{owner}/{repo}/installation"],
    getSubscriptionPlanForAccount: [
      "GET /marketplace_listing/accounts/{account_id}"
    ],
    getSubscriptionPlanForAccountStubbed: [
      "GET /marketplace_listing/stubbed/accounts/{account_id}"
    ],
    getUserInstallation: ["GET /users/{username}/installation"],
    getWebhookConfigForApp: ["GET /app/hook/config"],
    getWebhookDelivery: ["GET /app/hook/deliveries/{delivery_id}"],
    listAccountsForPlan: ["GET /marketplace_listing/plans/{plan_id}/accounts"],
    listAccountsForPlanStubbed: [
      "GET /marketplace_listing/stubbed/plans/{plan_id}/accounts"
    ],
    listInstallationReposForAuthenticatedUser: [
      "GET /user/installations/{installation_id}/repositories"
    ],
    listInstallationRequestsForAuthenticatedApp: [
      "GET /app/installation-requests"
    ],
    listInstallations: ["GET /app/installations"],
    listInstallationsForAuthenticatedUser: ["GET /user/installations"],
    listPlans: ["GET /marketplace_listing/plans"],
    listPlansStubbed: ["GET /marketplace_listing/stubbed/plans"],
    listReposAccessibleToInstallation: ["GET /installation/repositories"],
    listSubscriptionsForAuthenticatedUser: ["GET /user/marketplace_purchases"],
    listSubscriptionsForAuthenticatedUserStubbed: [
      "GET /user/marketplace_purchases/stubbed"
    ],
    listWebhookDeliveries: ["GET /app/hook/deliveries"],
    redeliverWebhookDelivery: [
      "POST /app/hook/deliveries/{delivery_id}/attempts"
    ],
    removeRepoFromInstallation: [
      "DELETE /user/installations/{installation_id}/repositories/{repository_id}",
      {},
      { renamed: ["apps", "removeRepoFromInstallationForAuthenticatedUser"] }
    ],
    removeRepoFromInstallationForAuthenticatedUser: [
      "DELETE /user/installations/{installation_id}/repositories/{repository_id}"
    ],
    resetToken: ["PATCH /applications/{client_id}/token"],
    revokeInstallationAccessToken: ["DELETE /installation/token"],
    scopeToken: ["POST /applications/{client_id}/token/scoped"],
    suspendInstallation: ["PUT /app/installations/{installation_id}/suspended"],
    unsuspendInstallation: [
      "DELETE /app/installations/{installation_id}/suspended"
    ],
    updateWebhookConfigForApp: ["PATCH /app/hook/config"]
  },
  billing: {
    getGithubActionsBillingOrg: ["GET /orgs/{org}/settings/billing/actions"],
    getGithubActionsBillingUser: [
      "GET /users/{username}/settings/billing/actions"
    ],
    getGithubBillingPremiumRequestUsageReportOrg: [
      "GET /organizations/{org}/settings/billing/premium_request/usage"
    ],
    getGithubBillingPremiumRequestUsageReportUser: [
      "GET /users/{username}/settings/billing/premium_request/usage"
    ],
    getGithubBillingUsageReportOrg: [
      "GET /organizations/{org}/settings/billing/usage"
    ],
    getGithubBillingUsageReportUser: [
      "GET /users/{username}/settings/billing/usage"
    ],
    getGithubPackagesBillingOrg: ["GET /orgs/{org}/settings/billing/packages"],
    getGithubPackagesBillingUser: [
      "GET /users/{username}/settings/billing/packages"
    ],
    getSharedStorageBillingOrg: [
      "GET /orgs/{org}/settings/billing/shared-storage"
    ],
    getSharedStorageBillingUser: [
      "GET /users/{username}/settings/billing/shared-storage"
    ]
  },
  campaigns: {
    createCampaign: ["POST /orgs/{org}/campaigns"],
    deleteCampaign: ["DELETE /orgs/{org}/campaigns/{campaign_number}"],
    getCampaignSummary: ["GET /orgs/{org}/campaigns/{campaign_number}"],
    listOrgCampaigns: ["GET /orgs/{org}/campaigns"],
    updateCampaign: ["PATCH /orgs/{org}/campaigns/{campaign_number}"]
  },
  checks: {
    create: ["POST /repos/{owner}/{repo}/check-runs"],
    createSuite: ["POST /repos/{owner}/{repo}/check-suites"],
    get: ["GET /repos/{owner}/{repo}/check-runs/{check_run_id}"],
    getSuite: ["GET /repos/{owner}/{repo}/check-suites/{check_suite_id}"],
    listAnnotations: [
      "GET /repos/{owner}/{repo}/check-runs/{check_run_id}/annotations"
    ],
    listForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/check-runs"],
    listForSuite: [
      "GET /repos/{owner}/{repo}/check-suites/{check_suite_id}/check-runs"
    ],
    listSuitesForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/check-suites"],
    rerequestRun: [
      "POST /repos/{owner}/{repo}/check-runs/{check_run_id}/rerequest"
    ],
    rerequestSuite: [
      "POST /repos/{owner}/{repo}/check-suites/{check_suite_id}/rerequest"
    ],
    setSuitesPreferences: [
      "PATCH /repos/{owner}/{repo}/check-suites/preferences"
    ],
    update: ["PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}"]
  },
  codeScanning: {
    commitAutofix: [
      "POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix/commits"
    ],
    createAutofix: [
      "POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix"
    ],
    createVariantAnalysis: [
      "POST /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses"
    ],
    deleteAnalysis: [
      "DELETE /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}{?confirm_delete}"
    ],
    deleteCodeqlDatabase: [
      "DELETE /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}"
    ],
    getAlert: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}",
      {},
      { renamedParameters: { alert_id: "alert_number" } }
    ],
    getAnalysis: [
      "GET /repos/{owner}/{repo}/code-scanning/analyses/{analysis_id}"
    ],
    getAutofix: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix"
    ],
    getCodeqlDatabase: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/databases/{language}"
    ],
    getDefaultSetup: ["GET /repos/{owner}/{repo}/code-scanning/default-setup"],
    getSarif: ["GET /repos/{owner}/{repo}/code-scanning/sarifs/{sarif_id}"],
    getVariantAnalysis: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}"
    ],
    getVariantAnalysisRepoTask: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/variant-analyses/{codeql_variant_analysis_id}/repos/{repo_owner}/{repo_name}"
    ],
    listAlertInstances: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/code-scanning/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/code-scanning/alerts"],
    listAlertsInstances: [
      "GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/instances",
      {},
      { renamed: ["codeScanning", "listAlertInstances"] }
    ],
    listCodeqlDatabases: [
      "GET /repos/{owner}/{repo}/code-scanning/codeql/databases"
    ],
    listRecentAnalyses: ["GET /repos/{owner}/{repo}/code-scanning/analyses"],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}"
    ],
    updateDefaultSetup: [
      "PATCH /repos/{owner}/{repo}/code-scanning/default-setup"
    ],
    uploadSarif: ["POST /repos/{owner}/{repo}/code-scanning/sarifs"]
  },
  codeSecurity: {
    attachConfiguration: [
      "POST /orgs/{org}/code-security/configurations/{configuration_id}/attach"
    ],
    attachEnterpriseConfiguration: [
      "POST /enterprises/{enterprise}/code-security/configurations/{configuration_id}/attach"
    ],
    createConfiguration: ["POST /orgs/{org}/code-security/configurations"],
    createConfigurationForEnterprise: [
      "POST /enterprises/{enterprise}/code-security/configurations"
    ],
    deleteConfiguration: [
      "DELETE /orgs/{org}/code-security/configurations/{configuration_id}"
    ],
    deleteConfigurationForEnterprise: [
      "DELETE /enterprises/{enterprise}/code-security/configurations/{configuration_id}"
    ],
    detachConfiguration: [
      "DELETE /orgs/{org}/code-security/configurations/detach"
    ],
    getConfiguration: [
      "GET /orgs/{org}/code-security/configurations/{configuration_id}"
    ],
    getConfigurationForRepository: [
      "GET /repos/{owner}/{repo}/code-security-configuration"
    ],
    getConfigurationsForEnterprise: [
      "GET /enterprises/{enterprise}/code-security/configurations"
    ],
    getConfigurationsForOrg: ["GET /orgs/{org}/code-security/configurations"],
    getDefaultConfigurations: [
      "GET /orgs/{org}/code-security/configurations/defaults"
    ],
    getDefaultConfigurationsForEnterprise: [
      "GET /enterprises/{enterprise}/code-security/configurations/defaults"
    ],
    getRepositoriesForConfiguration: [
      "GET /orgs/{org}/code-security/configurations/{configuration_id}/repositories"
    ],
    getRepositoriesForEnterpriseConfiguration: [
      "GET /enterprises/{enterprise}/code-security/configurations/{configuration_id}/repositories"
    ],
    getSingleConfigurationForEnterprise: [
      "GET /enterprises/{enterprise}/code-security/configurations/{configuration_id}"
    ],
    setConfigurationAsDefault: [
      "PUT /orgs/{org}/code-security/configurations/{configuration_id}/defaults"
    ],
    setConfigurationAsDefaultForEnterprise: [
      "PUT /enterprises/{enterprise}/code-security/configurations/{configuration_id}/defaults"
    ],
    updateConfiguration: [
      "PATCH /orgs/{org}/code-security/configurations/{configuration_id}"
    ],
    updateEnterpriseConfiguration: [
      "PATCH /enterprises/{enterprise}/code-security/configurations/{configuration_id}"
    ]
  },
  codesOfConduct: {
    getAllCodesOfConduct: ["GET /codes_of_conduct"],
    getConductCode: ["GET /codes_of_conduct/{key}"]
  },
  codespaces: {
    addRepositoryForSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    checkPermissionsForDevcontainer: [
      "GET /repos/{owner}/{repo}/codespaces/permissions_check"
    ],
    codespaceMachinesForAuthenticatedUser: [
      "GET /user/codespaces/{codespace_name}/machines"
    ],
    createForAuthenticatedUser: ["POST /user/codespaces"],
    createOrUpdateOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}"
    ],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    createOrUpdateSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}"
    ],
    createWithPrForAuthenticatedUser: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/codespaces"
    ],
    createWithRepoForAuthenticatedUser: [
      "POST /repos/{owner}/{repo}/codespaces"
    ],
    deleteForAuthenticatedUser: ["DELETE /user/codespaces/{codespace_name}"],
    deleteFromOrganization: [
      "DELETE /orgs/{org}/members/{username}/codespaces/{codespace_name}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/codespaces/secrets/{secret_name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    deleteSecretForAuthenticatedUser: [
      "DELETE /user/codespaces/secrets/{secret_name}"
    ],
    exportForAuthenticatedUser: [
      "POST /user/codespaces/{codespace_name}/exports"
    ],
    getCodespacesForUserInOrg: [
      "GET /orgs/{org}/members/{username}/codespaces"
    ],
    getExportDetailsForAuthenticatedUser: [
      "GET /user/codespaces/{codespace_name}/exports/{export_id}"
    ],
    getForAuthenticatedUser: ["GET /user/codespaces/{codespace_name}"],
    getOrgPublicKey: ["GET /orgs/{org}/codespaces/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/codespaces/secrets/{secret_name}"],
    getPublicKeyForAuthenticatedUser: [
      "GET /user/codespaces/secrets/public-key"
    ],
    getRepoPublicKey: [
      "GET /repos/{owner}/{repo}/codespaces/secrets/public-key"
    ],
    getRepoSecret: [
      "GET /repos/{owner}/{repo}/codespaces/secrets/{secret_name}"
    ],
    getSecretForAuthenticatedUser: [
      "GET /user/codespaces/secrets/{secret_name}"
    ],
    listDevcontainersInRepositoryForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/devcontainers"
    ],
    listForAuthenticatedUser: ["GET /user/codespaces"],
    listInOrganization: [
      "GET /orgs/{org}/codespaces",
      {},
      { renamedParameters: { org_id: "org" } }
    ],
    listInRepositoryForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces"
    ],
    listOrgSecrets: ["GET /orgs/{org}/codespaces/secrets"],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/codespaces/secrets"],
    listRepositoriesForSecretForAuthenticatedUser: [
      "GET /user/codespaces/secrets/{secret_name}/repositories"
    ],
    listSecretsForAuthenticatedUser: ["GET /user/codespaces/secrets"],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/codespaces/secrets/{secret_name}/repositories"
    ],
    preFlightWithRepoForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/new"
    ],
    publishForAuthenticatedUser: [
      "POST /user/codespaces/{codespace_name}/publish"
    ],
    removeRepositoryForSecretForAuthenticatedUser: [
      "DELETE /user/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/codespaces/secrets/{secret_name}/repositories/{repository_id}"
    ],
    repoMachinesForAuthenticatedUser: [
      "GET /repos/{owner}/{repo}/codespaces/machines"
    ],
    setRepositoriesForSecretForAuthenticatedUser: [
      "PUT /user/codespaces/secrets/{secret_name}/repositories"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/codespaces/secrets/{secret_name}/repositories"
    ],
    startForAuthenticatedUser: ["POST /user/codespaces/{codespace_name}/start"],
    stopForAuthenticatedUser: ["POST /user/codespaces/{codespace_name}/stop"],
    stopInOrganization: [
      "POST /orgs/{org}/members/{username}/codespaces/{codespace_name}/stop"
    ],
    updateForAuthenticatedUser: ["PATCH /user/codespaces/{codespace_name}"]
  },
  copilot: {
    addCopilotSeatsForTeams: [
      "POST /orgs/{org}/copilot/billing/selected_teams"
    ],
    addCopilotSeatsForUsers: [
      "POST /orgs/{org}/copilot/billing/selected_users"
    ],
    cancelCopilotSeatAssignmentForTeams: [
      "DELETE /orgs/{org}/copilot/billing/selected_teams"
    ],
    cancelCopilotSeatAssignmentForUsers: [
      "DELETE /orgs/{org}/copilot/billing/selected_users"
    ],
    copilotMetricsForOrganization: ["GET /orgs/{org}/copilot/metrics"],
    copilotMetricsForTeam: ["GET /orgs/{org}/team/{team_slug}/copilot/metrics"],
    getCopilotOrganizationDetails: ["GET /orgs/{org}/copilot/billing"],
    getCopilotSeatDetailsForUser: [
      "GET /orgs/{org}/members/{username}/copilot"
    ],
    listCopilotSeats: ["GET /orgs/{org}/copilot/billing/seats"]
  },
  credentials: { revoke: ["POST /credentials/revoke"] },
  dependabot: {
    addSelectedRepoToOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}"
    ],
    createOrUpdateOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}"
    ],
    createOrUpdateRepoSecret: [
      "PUT /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    deleteOrgSecret: ["DELETE /orgs/{org}/dependabot/secrets/{secret_name}"],
    deleteRepoSecret: [
      "DELETE /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    getAlert: ["GET /repos/{owner}/{repo}/dependabot/alerts/{alert_number}"],
    getOrgPublicKey: ["GET /orgs/{org}/dependabot/secrets/public-key"],
    getOrgSecret: ["GET /orgs/{org}/dependabot/secrets/{secret_name}"],
    getRepoPublicKey: [
      "GET /repos/{owner}/{repo}/dependabot/secrets/public-key"
    ],
    getRepoSecret: [
      "GET /repos/{owner}/{repo}/dependabot/secrets/{secret_name}"
    ],
    listAlertsForEnterprise: [
      "GET /enterprises/{enterprise}/dependabot/alerts"
    ],
    listAlertsForOrg: ["GET /orgs/{org}/dependabot/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/dependabot/alerts"],
    listOrgSecrets: ["GET /orgs/{org}/dependabot/secrets"],
    listRepoSecrets: ["GET /repos/{owner}/{repo}/dependabot/secrets"],
    listSelectedReposForOrgSecret: [
      "GET /orgs/{org}/dependabot/secrets/{secret_name}/repositories"
    ],
    removeSelectedRepoFromOrgSecret: [
      "DELETE /orgs/{org}/dependabot/secrets/{secret_name}/repositories/{repository_id}"
    ],
    repositoryAccessForOrg: [
      "GET /organizations/{org}/dependabot/repository-access"
    ],
    setRepositoryAccessDefaultLevel: [
      "PUT /organizations/{org}/dependabot/repository-access/default-level"
    ],
    setSelectedReposForOrgSecret: [
      "PUT /orgs/{org}/dependabot/secrets/{secret_name}/repositories"
    ],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/dependabot/alerts/{alert_number}"
    ],
    updateRepositoryAccessForOrg: [
      "PATCH /organizations/{org}/dependabot/repository-access"
    ]
  },
  dependencyGraph: {
    createRepositorySnapshot: [
      "POST /repos/{owner}/{repo}/dependency-graph/snapshots"
    ],
    diffRange: [
      "GET /repos/{owner}/{repo}/dependency-graph/compare/{basehead}"
    ],
    exportSbom: ["GET /repos/{owner}/{repo}/dependency-graph/sbom"]
  },
  emojis: { get: ["GET /emojis"] },
  enterpriseTeamMemberships: {
    add: [
      "PUT /enterprises/{enterprise}/teams/{enterprise-team}/memberships/{username}"
    ],
    bulkAdd: [
      "POST /enterprises/{enterprise}/teams/{enterprise-team}/memberships/add"
    ],
    bulkRemove: [
      "POST /enterprises/{enterprise}/teams/{enterprise-team}/memberships/remove"
    ],
    get: [
      "GET /enterprises/{enterprise}/teams/{enterprise-team}/memberships/{username}"
    ],
    list: ["GET /enterprises/{enterprise}/teams/{enterprise-team}/memberships"],
    remove: [
      "DELETE /enterprises/{enterprise}/teams/{enterprise-team}/memberships/{username}"
    ]
  },
  enterpriseTeamOrganizations: {
    add: [
      "PUT /enterprises/{enterprise}/teams/{enterprise-team}/organizations/{org}"
    ],
    bulkAdd: [
      "POST /enterprises/{enterprise}/teams/{enterprise-team}/organizations/add"
    ],
    bulkRemove: [
      "POST /enterprises/{enterprise}/teams/{enterprise-team}/organizations/remove"
    ],
    delete: [
      "DELETE /enterprises/{enterprise}/teams/{enterprise-team}/organizations/{org}"
    ],
    getAssignment: [
      "GET /enterprises/{enterprise}/teams/{enterprise-team}/organizations/{org}"
    ],
    getAssignments: [
      "GET /enterprises/{enterprise}/teams/{enterprise-team}/organizations"
    ]
  },
  enterpriseTeams: {
    create: ["POST /enterprises/{enterprise}/teams"],
    delete: ["DELETE /enterprises/{enterprise}/teams/{team_slug}"],
    get: ["GET /enterprises/{enterprise}/teams/{team_slug}"],
    list: ["GET /enterprises/{enterprise}/teams"],
    update: ["PATCH /enterprises/{enterprise}/teams/{team_slug}"]
  },
  gists: {
    checkIsStarred: ["GET /gists/{gist_id}/star"],
    create: ["POST /gists"],
    createComment: ["POST /gists/{gist_id}/comments"],
    delete: ["DELETE /gists/{gist_id}"],
    deleteComment: ["DELETE /gists/{gist_id}/comments/{comment_id}"],
    fork: ["POST /gists/{gist_id}/forks"],
    get: ["GET /gists/{gist_id}"],
    getComment: ["GET /gists/{gist_id}/comments/{comment_id}"],
    getRevision: ["GET /gists/{gist_id}/{sha}"],
    list: ["GET /gists"],
    listComments: ["GET /gists/{gist_id}/comments"],
    listCommits: ["GET /gists/{gist_id}/commits"],
    listForUser: ["GET /users/{username}/gists"],
    listForks: ["GET /gists/{gist_id}/forks"],
    listPublic: ["GET /gists/public"],
    listStarred: ["GET /gists/starred"],
    star: ["PUT /gists/{gist_id}/star"],
    unstar: ["DELETE /gists/{gist_id}/star"],
    update: ["PATCH /gists/{gist_id}"],
    updateComment: ["PATCH /gists/{gist_id}/comments/{comment_id}"]
  },
  git: {
    createBlob: ["POST /repos/{owner}/{repo}/git/blobs"],
    createCommit: ["POST /repos/{owner}/{repo}/git/commits"],
    createRef: ["POST /repos/{owner}/{repo}/git/refs"],
    createTag: ["POST /repos/{owner}/{repo}/git/tags"],
    createTree: ["POST /repos/{owner}/{repo}/git/trees"],
    deleteRef: ["DELETE /repos/{owner}/{repo}/git/refs/{ref}"],
    getBlob: ["GET /repos/{owner}/{repo}/git/blobs/{file_sha}"],
    getCommit: ["GET /repos/{owner}/{repo}/git/commits/{commit_sha}"],
    getRef: ["GET /repos/{owner}/{repo}/git/ref/{ref}"],
    getTag: ["GET /repos/{owner}/{repo}/git/tags/{tag_sha}"],
    getTree: ["GET /repos/{owner}/{repo}/git/trees/{tree_sha}"],
    listMatchingRefs: ["GET /repos/{owner}/{repo}/git/matching-refs/{ref}"],
    updateRef: ["PATCH /repos/{owner}/{repo}/git/refs/{ref}"]
  },
  gitignore: {
    getAllTemplates: ["GET /gitignore/templates"],
    getTemplate: ["GET /gitignore/templates/{name}"]
  },
  hostedCompute: {
    createNetworkConfigurationForOrg: [
      "POST /orgs/{org}/settings/network-configurations"
    ],
    deleteNetworkConfigurationFromOrg: [
      "DELETE /orgs/{org}/settings/network-configurations/{network_configuration_id}"
    ],
    getNetworkConfigurationForOrg: [
      "GET /orgs/{org}/settings/network-configurations/{network_configuration_id}"
    ],
    getNetworkSettingsForOrg: [
      "GET /orgs/{org}/settings/network-settings/{network_settings_id}"
    ],
    listNetworkConfigurationsForOrg: [
      "GET /orgs/{org}/settings/network-configurations"
    ],
    updateNetworkConfigurationForOrg: [
      "PATCH /orgs/{org}/settings/network-configurations/{network_configuration_id}"
    ]
  },
  interactions: {
    getRestrictionsForAuthenticatedUser: ["GET /user/interaction-limits"],
    getRestrictionsForOrg: ["GET /orgs/{org}/interaction-limits"],
    getRestrictionsForRepo: ["GET /repos/{owner}/{repo}/interaction-limits"],
    getRestrictionsForYourPublicRepos: [
      "GET /user/interaction-limits",
      {},
      { renamed: ["interactions", "getRestrictionsForAuthenticatedUser"] }
    ],
    removeRestrictionsForAuthenticatedUser: ["DELETE /user/interaction-limits"],
    removeRestrictionsForOrg: ["DELETE /orgs/{org}/interaction-limits"],
    removeRestrictionsForRepo: [
      "DELETE /repos/{owner}/{repo}/interaction-limits"
    ],
    removeRestrictionsForYourPublicRepos: [
      "DELETE /user/interaction-limits",
      {},
      { renamed: ["interactions", "removeRestrictionsForAuthenticatedUser"] }
    ],
    setRestrictionsForAuthenticatedUser: ["PUT /user/interaction-limits"],
    setRestrictionsForOrg: ["PUT /orgs/{org}/interaction-limits"],
    setRestrictionsForRepo: ["PUT /repos/{owner}/{repo}/interaction-limits"],
    setRestrictionsForYourPublicRepos: [
      "PUT /user/interaction-limits",
      {},
      { renamed: ["interactions", "setRestrictionsForAuthenticatedUser"] }
    ]
  },
  issues: {
    addAssignees: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/assignees"
    ],
    addBlockedByDependency: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by"
    ],
    addLabels: ["POST /repos/{owner}/{repo}/issues/{issue_number}/labels"],
    addSubIssue: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues"
    ],
    checkUserCanBeAssigned: ["GET /repos/{owner}/{repo}/assignees/{assignee}"],
    checkUserCanBeAssignedToIssue: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/assignees/{assignee}"
    ],
    create: ["POST /repos/{owner}/{repo}/issues"],
    createComment: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments"
    ],
    createLabel: ["POST /repos/{owner}/{repo}/labels"],
    createMilestone: ["POST /repos/{owner}/{repo}/milestones"],
    deleteComment: [
      "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}"
    ],
    deleteLabel: ["DELETE /repos/{owner}/{repo}/labels/{name}"],
    deleteMilestone: [
      "DELETE /repos/{owner}/{repo}/milestones/{milestone_number}"
    ],
    get: ["GET /repos/{owner}/{repo}/issues/{issue_number}"],
    getComment: ["GET /repos/{owner}/{repo}/issues/comments/{comment_id}"],
    getEvent: ["GET /repos/{owner}/{repo}/issues/events/{event_id}"],
    getLabel: ["GET /repos/{owner}/{repo}/labels/{name}"],
    getMilestone: ["GET /repos/{owner}/{repo}/milestones/{milestone_number}"],
    getParent: ["GET /repos/{owner}/{repo}/issues/{issue_number}/parent"],
    list: ["GET /issues"],
    listAssignees: ["GET /repos/{owner}/{repo}/assignees"],
    listComments: ["GET /repos/{owner}/{repo}/issues/{issue_number}/comments"],
    listCommentsForRepo: ["GET /repos/{owner}/{repo}/issues/comments"],
    listDependenciesBlockedBy: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by"
    ],
    listDependenciesBlocking: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocking"
    ],
    listEvents: ["GET /repos/{owner}/{repo}/issues/{issue_number}/events"],
    listEventsForRepo: ["GET /repos/{owner}/{repo}/issues/events"],
    listEventsForTimeline: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline"
    ],
    listForAuthenticatedUser: ["GET /user/issues"],
    listForOrg: ["GET /orgs/{org}/issues"],
    listForRepo: ["GET /repos/{owner}/{repo}/issues"],
    listLabelsForMilestone: [
      "GET /repos/{owner}/{repo}/milestones/{milestone_number}/labels"
    ],
    listLabelsForRepo: ["GET /repos/{owner}/{repo}/labels"],
    listLabelsOnIssue: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/labels"
    ],
    listMilestones: ["GET /repos/{owner}/{repo}/milestones"],
    listSubIssues: [
      "GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues"
    ],
    lock: ["PUT /repos/{owner}/{repo}/issues/{issue_number}/lock"],
    removeAllLabels: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels"
    ],
    removeAssignees: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/assignees"
    ],
    removeDependencyBlockedBy: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/dependencies/blocked_by/{issue_id}"
    ],
    removeLabel: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}"
    ],
    removeSubIssue: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue"
    ],
    reprioritizeSubIssue: [
      "PATCH /repos/{owner}/{repo}/issues/{issue_number}/sub_issues/priority"
    ],
    setLabels: ["PUT /repos/{owner}/{repo}/issues/{issue_number}/labels"],
    unlock: ["DELETE /repos/{owner}/{repo}/issues/{issue_number}/lock"],
    update: ["PATCH /repos/{owner}/{repo}/issues/{issue_number}"],
    updateComment: ["PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}"],
    updateLabel: ["PATCH /repos/{owner}/{repo}/labels/{name}"],
    updateMilestone: [
      "PATCH /repos/{owner}/{repo}/milestones/{milestone_number}"
    ]
  },
  licenses: {
    get: ["GET /licenses/{license}"],
    getAllCommonlyUsed: ["GET /licenses"],
    getForRepo: ["GET /repos/{owner}/{repo}/license"]
  },
  markdown: {
    render: ["POST /markdown"],
    renderRaw: [
      "POST /markdown/raw",
      { headers: { "content-type": "text/plain; charset=utf-8" } }
    ]
  },
  meta: {
    get: ["GET /meta"],
    getAllVersions: ["GET /versions"],
    getOctocat: ["GET /octocat"],
    getZen: ["GET /zen"],
    root: ["GET /"]
  },
  migrations: {
    deleteArchiveForAuthenticatedUser: [
      "DELETE /user/migrations/{migration_id}/archive"
    ],
    deleteArchiveForOrg: [
      "DELETE /orgs/{org}/migrations/{migration_id}/archive"
    ],
    downloadArchiveForOrg: [
      "GET /orgs/{org}/migrations/{migration_id}/archive"
    ],
    getArchiveForAuthenticatedUser: [
      "GET /user/migrations/{migration_id}/archive"
    ],
    getStatusForAuthenticatedUser: ["GET /user/migrations/{migration_id}"],
    getStatusForOrg: ["GET /orgs/{org}/migrations/{migration_id}"],
    listForAuthenticatedUser: ["GET /user/migrations"],
    listForOrg: ["GET /orgs/{org}/migrations"],
    listReposForAuthenticatedUser: [
      "GET /user/migrations/{migration_id}/repositories"
    ],
    listReposForOrg: ["GET /orgs/{org}/migrations/{migration_id}/repositories"],
    listReposForUser: [
      "GET /user/migrations/{migration_id}/repositories",
      {},
      { renamed: ["migrations", "listReposForAuthenticatedUser"] }
    ],
    startForAuthenticatedUser: ["POST /user/migrations"],
    startForOrg: ["POST /orgs/{org}/migrations"],
    unlockRepoForAuthenticatedUser: [
      "DELETE /user/migrations/{migration_id}/repos/{repo_name}/lock"
    ],
    unlockRepoForOrg: [
      "DELETE /orgs/{org}/migrations/{migration_id}/repos/{repo_name}/lock"
    ]
  },
  oidc: {
    getOidcCustomSubTemplateForOrg: [
      "GET /orgs/{org}/actions/oidc/customization/sub"
    ],
    updateOidcCustomSubTemplateForOrg: [
      "PUT /orgs/{org}/actions/oidc/customization/sub"
    ]
  },
  orgs: {
    addSecurityManagerTeam: [
      "PUT /orgs/{org}/security-managers/teams/{team_slug}",
      {},
      {
        deprecated: "octokit.rest.orgs.addSecurityManagerTeam() is deprecated, see https://docs.github.com/rest/orgs/security-managers#add-a-security-manager-team"
      }
    ],
    assignTeamToOrgRole: [
      "PUT /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}"
    ],
    assignUserToOrgRole: [
      "PUT /orgs/{org}/organization-roles/users/{username}/{role_id}"
    ],
    blockUser: ["PUT /orgs/{org}/blocks/{username}"],
    cancelInvitation: ["DELETE /orgs/{org}/invitations/{invitation_id}"],
    checkBlockedUser: ["GET /orgs/{org}/blocks/{username}"],
    checkMembershipForUser: ["GET /orgs/{org}/members/{username}"],
    checkPublicMembershipForUser: ["GET /orgs/{org}/public_members/{username}"],
    convertMemberToOutsideCollaborator: [
      "PUT /orgs/{org}/outside_collaborators/{username}"
    ],
    createArtifactStorageRecord: [
      "POST /orgs/{org}/artifacts/metadata/storage-record"
    ],
    createInvitation: ["POST /orgs/{org}/invitations"],
    createIssueType: ["POST /orgs/{org}/issue-types"],
    createWebhook: ["POST /orgs/{org}/hooks"],
    customPropertiesForOrgsCreateOrUpdateOrganizationValues: [
      "PATCH /organizations/{org}/org-properties/values"
    ],
    customPropertiesForOrgsGetOrganizationValues: [
      "GET /organizations/{org}/org-properties/values"
    ],
    customPropertiesForReposCreateOrUpdateOrganizationDefinition: [
      "PUT /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    customPropertiesForReposCreateOrUpdateOrganizationDefinitions: [
      "PATCH /orgs/{org}/properties/schema"
    ],
    customPropertiesForReposCreateOrUpdateOrganizationValues: [
      "PATCH /orgs/{org}/properties/values"
    ],
    customPropertiesForReposDeleteOrganizationDefinition: [
      "DELETE /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    customPropertiesForReposGetOrganizationDefinition: [
      "GET /orgs/{org}/properties/schema/{custom_property_name}"
    ],
    customPropertiesForReposGetOrganizationDefinitions: [
      "GET /orgs/{org}/properties/schema"
    ],
    customPropertiesForReposGetOrganizationValues: [
      "GET /orgs/{org}/properties/values"
    ],
    delete: ["DELETE /orgs/{org}"],
    deleteAttestationsBulk: ["POST /orgs/{org}/attestations/delete-request"],
    deleteAttestationsById: [
      "DELETE /orgs/{org}/attestations/{attestation_id}"
    ],
    deleteAttestationsBySubjectDigest: [
      "DELETE /orgs/{org}/attestations/digest/{subject_digest}"
    ],
    deleteIssueType: ["DELETE /orgs/{org}/issue-types/{issue_type_id}"],
    deleteWebhook: ["DELETE /orgs/{org}/hooks/{hook_id}"],
    disableSelectedRepositoryImmutableReleasesOrganization: [
      "DELETE /orgs/{org}/settings/immutable-releases/repositories/{repository_id}"
    ],
    enableSelectedRepositoryImmutableReleasesOrganization: [
      "PUT /orgs/{org}/settings/immutable-releases/repositories/{repository_id}"
    ],
    get: ["GET /orgs/{org}"],
    getImmutableReleasesSettings: [
      "GET /orgs/{org}/settings/immutable-releases"
    ],
    getImmutableReleasesSettingsRepositories: [
      "GET /orgs/{org}/settings/immutable-releases/repositories"
    ],
    getMembershipForAuthenticatedUser: ["GET /user/memberships/orgs/{org}"],
    getMembershipForUser: ["GET /orgs/{org}/memberships/{username}"],
    getOrgRole: ["GET /orgs/{org}/organization-roles/{role_id}"],
    getOrgRulesetHistory: ["GET /orgs/{org}/rulesets/{ruleset_id}/history"],
    getOrgRulesetVersion: [
      "GET /orgs/{org}/rulesets/{ruleset_id}/history/{version_id}"
    ],
    getWebhook: ["GET /orgs/{org}/hooks/{hook_id}"],
    getWebhookConfigForOrg: ["GET /orgs/{org}/hooks/{hook_id}/config"],
    getWebhookDelivery: [
      "GET /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}"
    ],
    list: ["GET /organizations"],
    listAppInstallations: ["GET /orgs/{org}/installations"],
    listArtifactStorageRecords: [
      "GET /orgs/{org}/artifacts/{subject_digest}/metadata/storage-records"
    ],
    listAttestationRepositories: ["GET /orgs/{org}/attestations/repositories"],
    listAttestations: ["GET /orgs/{org}/attestations/{subject_digest}"],
    listAttestationsBulk: [
      "POST /orgs/{org}/attestations/bulk-list{?per_page,before,after}"
    ],
    listBlockedUsers: ["GET /orgs/{org}/blocks"],
    listFailedInvitations: ["GET /orgs/{org}/failed_invitations"],
    listForAuthenticatedUser: ["GET /user/orgs"],
    listForUser: ["GET /users/{username}/orgs"],
    listInvitationTeams: ["GET /orgs/{org}/invitations/{invitation_id}/teams"],
    listIssueTypes: ["GET /orgs/{org}/issue-types"],
    listMembers: ["GET /orgs/{org}/members"],
    listMembershipsForAuthenticatedUser: ["GET /user/memberships/orgs"],
    listOrgRoleTeams: ["GET /orgs/{org}/organization-roles/{role_id}/teams"],
    listOrgRoleUsers: ["GET /orgs/{org}/organization-roles/{role_id}/users"],
    listOrgRoles: ["GET /orgs/{org}/organization-roles"],
    listOrganizationFineGrainedPermissions: [
      "GET /orgs/{org}/organization-fine-grained-permissions"
    ],
    listOutsideCollaborators: ["GET /orgs/{org}/outside_collaborators"],
    listPatGrantRepositories: [
      "GET /orgs/{org}/personal-access-tokens/{pat_id}/repositories"
    ],
    listPatGrantRequestRepositories: [
      "GET /orgs/{org}/personal-access-token-requests/{pat_request_id}/repositories"
    ],
    listPatGrantRequests: ["GET /orgs/{org}/personal-access-token-requests"],
    listPatGrants: ["GET /orgs/{org}/personal-access-tokens"],
    listPendingInvitations: ["GET /orgs/{org}/invitations"],
    listPublicMembers: ["GET /orgs/{org}/public_members"],
    listSecurityManagerTeams: [
      "GET /orgs/{org}/security-managers",
      {},
      {
        deprecated: "octokit.rest.orgs.listSecurityManagerTeams() is deprecated, see https://docs.github.com/rest/orgs/security-managers#list-security-manager-teams"
      }
    ],
    listWebhookDeliveries: ["GET /orgs/{org}/hooks/{hook_id}/deliveries"],
    listWebhooks: ["GET /orgs/{org}/hooks"],
    pingWebhook: ["POST /orgs/{org}/hooks/{hook_id}/pings"],
    redeliverWebhookDelivery: [
      "POST /orgs/{org}/hooks/{hook_id}/deliveries/{delivery_id}/attempts"
    ],
    removeMember: ["DELETE /orgs/{org}/members/{username}"],
    removeMembershipForUser: ["DELETE /orgs/{org}/memberships/{username}"],
    removeOutsideCollaborator: [
      "DELETE /orgs/{org}/outside_collaborators/{username}"
    ],
    removePublicMembershipForAuthenticatedUser: [
      "DELETE /orgs/{org}/public_members/{username}"
    ],
    removeSecurityManagerTeam: [
      "DELETE /orgs/{org}/security-managers/teams/{team_slug}",
      {},
      {
        deprecated: "octokit.rest.orgs.removeSecurityManagerTeam() is deprecated, see https://docs.github.com/rest/orgs/security-managers#remove-a-security-manager-team"
      }
    ],
    reviewPatGrantRequest: [
      "POST /orgs/{org}/personal-access-token-requests/{pat_request_id}"
    ],
    reviewPatGrantRequestsInBulk: [
      "POST /orgs/{org}/personal-access-token-requests"
    ],
    revokeAllOrgRolesTeam: [
      "DELETE /orgs/{org}/organization-roles/teams/{team_slug}"
    ],
    revokeAllOrgRolesUser: [
      "DELETE /orgs/{org}/organization-roles/users/{username}"
    ],
    revokeOrgRoleTeam: [
      "DELETE /orgs/{org}/organization-roles/teams/{team_slug}/{role_id}"
    ],
    revokeOrgRoleUser: [
      "DELETE /orgs/{org}/organization-roles/users/{username}/{role_id}"
    ],
    setImmutableReleasesSettings: [
      "PUT /orgs/{org}/settings/immutable-releases"
    ],
    setImmutableReleasesSettingsRepositories: [
      "PUT /orgs/{org}/settings/immutable-releases/repositories"
    ],
    setMembershipForUser: ["PUT /orgs/{org}/memberships/{username}"],
    setPublicMembershipForAuthenticatedUser: [
      "PUT /orgs/{org}/public_members/{username}"
    ],
    unblockUser: ["DELETE /orgs/{org}/blocks/{username}"],
    update: ["PATCH /orgs/{org}"],
    updateIssueType: ["PUT /orgs/{org}/issue-types/{issue_type_id}"],
    updateMembershipForAuthenticatedUser: [
      "PATCH /user/memberships/orgs/{org}"
    ],
    updatePatAccess: ["POST /orgs/{org}/personal-access-tokens/{pat_id}"],
    updatePatAccesses: ["POST /orgs/{org}/personal-access-tokens"],
    updateWebhook: ["PATCH /orgs/{org}/hooks/{hook_id}"],
    updateWebhookConfigForOrg: ["PATCH /orgs/{org}/hooks/{hook_id}/config"]
  },
  packages: {
    deletePackageForAuthenticatedUser: [
      "DELETE /user/packages/{package_type}/{package_name}"
    ],
    deletePackageForOrg: [
      "DELETE /orgs/{org}/packages/{package_type}/{package_name}"
    ],
    deletePackageForUser: [
      "DELETE /users/{username}/packages/{package_type}/{package_name}"
    ],
    deletePackageVersionForAuthenticatedUser: [
      "DELETE /user/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    deletePackageVersionForOrg: [
      "DELETE /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    deletePackageVersionForUser: [
      "DELETE /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getAllPackageVersionsForAPackageOwnedByAnOrg: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions",
      {},
      { renamed: ["packages", "getAllPackageVersionsForPackageOwnedByOrg"] }
    ],
    getAllPackageVersionsForAPackageOwnedByTheAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions",
      {},
      {
        renamed: [
          "packages",
          "getAllPackageVersionsForPackageOwnedByAuthenticatedUser"
        ]
      }
    ],
    getAllPackageVersionsForPackageOwnedByAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions"
    ],
    getAllPackageVersionsForPackageOwnedByOrg: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions"
    ],
    getAllPackageVersionsForPackageOwnedByUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}/versions"
    ],
    getPackageForAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}"
    ],
    getPackageForOrganization: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}"
    ],
    getPackageForUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}"
    ],
    getPackageVersionForAuthenticatedUser: [
      "GET /user/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getPackageVersionForOrganization: [
      "GET /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    getPackageVersionForUser: [
      "GET /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}"
    ],
    listDockerMigrationConflictingPackagesForAuthenticatedUser: [
      "GET /user/docker/conflicts"
    ],
    listDockerMigrationConflictingPackagesForOrganization: [
      "GET /orgs/{org}/docker/conflicts"
    ],
    listDockerMigrationConflictingPackagesForUser: [
      "GET /users/{username}/docker/conflicts"
    ],
    listPackagesForAuthenticatedUser: ["GET /user/packages"],
    listPackagesForOrganization: ["GET /orgs/{org}/packages"],
    listPackagesForUser: ["GET /users/{username}/packages"],
    restorePackageForAuthenticatedUser: [
      "POST /user/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageForOrg: [
      "POST /orgs/{org}/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageForUser: [
      "POST /users/{username}/packages/{package_type}/{package_name}/restore{?token}"
    ],
    restorePackageVersionForAuthenticatedUser: [
      "POST /user/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ],
    restorePackageVersionForOrg: [
      "POST /orgs/{org}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ],
    restorePackageVersionForUser: [
      "POST /users/{username}/packages/{package_type}/{package_name}/versions/{package_version_id}/restore"
    ]
  },
  privateRegistries: {
    createOrgPrivateRegistry: ["POST /orgs/{org}/private-registries"],
    deleteOrgPrivateRegistry: [
      "DELETE /orgs/{org}/private-registries/{secret_name}"
    ],
    getOrgPrivateRegistry: ["GET /orgs/{org}/private-registries/{secret_name}"],
    getOrgPublicKey: ["GET /orgs/{org}/private-registries/public-key"],
    listOrgPrivateRegistries: ["GET /orgs/{org}/private-registries"],
    updateOrgPrivateRegistry: [
      "PATCH /orgs/{org}/private-registries/{secret_name}"
    ]
  },
  projects: {
    addItemForOrg: ["POST /orgs/{org}/projectsV2/{project_number}/items"],
    addItemForUser: [
      "POST /users/{username}/projectsV2/{project_number}/items"
    ],
    deleteItemForOrg: [
      "DELETE /orgs/{org}/projectsV2/{project_number}/items/{item_id}"
    ],
    deleteItemForUser: [
      "DELETE /users/{username}/projectsV2/{project_number}/items/{item_id}"
    ],
    getFieldForOrg: [
      "GET /orgs/{org}/projectsV2/{project_number}/fields/{field_id}"
    ],
    getFieldForUser: [
      "GET /users/{username}/projectsV2/{project_number}/fields/{field_id}"
    ],
    getForOrg: ["GET /orgs/{org}/projectsV2/{project_number}"],
    getForUser: ["GET /users/{username}/projectsV2/{project_number}"],
    getOrgItem: ["GET /orgs/{org}/projectsV2/{project_number}/items/{item_id}"],
    getUserItem: [
      "GET /users/{username}/projectsV2/{project_number}/items/{item_id}"
    ],
    listFieldsForOrg: ["GET /orgs/{org}/projectsV2/{project_number}/fields"],
    listFieldsForUser: [
      "GET /users/{username}/projectsV2/{project_number}/fields"
    ],
    listForOrg: ["GET /orgs/{org}/projectsV2"],
    listForUser: ["GET /users/{username}/projectsV2"],
    listItemsForOrg: ["GET /orgs/{org}/projectsV2/{project_number}/items"],
    listItemsForUser: [
      "GET /users/{username}/projectsV2/{project_number}/items"
    ],
    updateItemForOrg: [
      "PATCH /orgs/{org}/projectsV2/{project_number}/items/{item_id}"
    ],
    updateItemForUser: [
      "PATCH /users/{username}/projectsV2/{project_number}/items/{item_id}"
    ]
  },
  pulls: {
    checkIfMerged: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/merge"],
    create: ["POST /repos/{owner}/{repo}/pulls"],
    createReplyForReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies"
    ],
    createReview: ["POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews"],
    createReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/comments"
    ],
    deletePendingReview: [
      "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    deleteReviewComment: [
      "DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}"
    ],
    dismissReview: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals"
    ],
    get: ["GET /repos/{owner}/{repo}/pulls/{pull_number}"],
    getReview: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    getReviewComment: ["GET /repos/{owner}/{repo}/pulls/comments/{comment_id}"],
    list: ["GET /repos/{owner}/{repo}/pulls"],
    listCommentsForReview: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/comments"
    ],
    listCommits: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/commits"],
    listFiles: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/files"],
    listRequestedReviewers: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    listReviewComments: [
      "GET /repos/{owner}/{repo}/pulls/{pull_number}/comments"
    ],
    listReviewCommentsForRepo: ["GET /repos/{owner}/{repo}/pulls/comments"],
    listReviews: ["GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews"],
    merge: ["PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge"],
    removeRequestedReviewers: [
      "DELETE /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    requestReviewers: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/requested_reviewers"
    ],
    submitReview: [
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/events"
    ],
    update: ["PATCH /repos/{owner}/{repo}/pulls/{pull_number}"],
    updateBranch: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/update-branch"
    ],
    updateReview: [
      "PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}"
    ],
    updateReviewComment: [
      "PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}"
    ]
  },
  rateLimit: { get: ["GET /rate_limit"] },
  reactions: {
    createForCommitComment: [
      "POST /repos/{owner}/{repo}/comments/{comment_id}/reactions"
    ],
    createForIssue: [
      "POST /repos/{owner}/{repo}/issues/{issue_number}/reactions"
    ],
    createForIssueComment: [
      "POST /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions"
    ],
    createForPullRequestReviewComment: [
      "POST /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions"
    ],
    createForRelease: [
      "POST /repos/{owner}/{repo}/releases/{release_id}/reactions"
    ],
    createForTeamDiscussionCommentInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions"
    ],
    createForTeamDiscussionInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions"
    ],
    deleteForCommitComment: [
      "DELETE /repos/{owner}/{repo}/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForIssue: [
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/reactions/{reaction_id}"
    ],
    deleteForIssueComment: [
      "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForPullRequestComment: [
      "DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions/{reaction_id}"
    ],
    deleteForRelease: [
      "DELETE /repos/{owner}/{repo}/releases/{release_id}/reactions/{reaction_id}"
    ],
    deleteForTeamDiscussion: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions/{reaction_id}"
    ],
    deleteForTeamDiscussionComment: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions/{reaction_id}"
    ],
    listForCommitComment: [
      "GET /repos/{owner}/{repo}/comments/{comment_id}/reactions"
    ],
    listForIssue: ["GET /repos/{owner}/{repo}/issues/{issue_number}/reactions"],
    listForIssueComment: [
      "GET /repos/{owner}/{repo}/issues/comments/{comment_id}/reactions"
    ],
    listForPullRequestReviewComment: [
      "GET /repos/{owner}/{repo}/pulls/comments/{comment_id}/reactions"
    ],
    listForRelease: [
      "GET /repos/{owner}/{repo}/releases/{release_id}/reactions"
    ],
    listForTeamDiscussionCommentInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}/reactions"
    ],
    listForTeamDiscussionInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/reactions"
    ]
  },
  repos: {
    acceptInvitation: [
      "PATCH /user/repository_invitations/{invitation_id}",
      {},
      { renamed: ["repos", "acceptInvitationForAuthenticatedUser"] }
    ],
    acceptInvitationForAuthenticatedUser: [
      "PATCH /user/repository_invitations/{invitation_id}"
    ],
    addAppAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    addCollaborator: ["PUT /repos/{owner}/{repo}/collaborators/{username}"],
    addStatusCheckContexts: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    addTeamAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    addUserAccessRestrictions: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    cancelPagesDeployment: [
      "POST /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}/cancel"
    ],
    checkAutomatedSecurityFixes: [
      "GET /repos/{owner}/{repo}/automated-security-fixes"
    ],
    checkCollaborator: ["GET /repos/{owner}/{repo}/collaborators/{username}"],
    checkImmutableReleases: ["GET /repos/{owner}/{repo}/immutable-releases"],
    checkPrivateVulnerabilityReporting: [
      "GET /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    checkVulnerabilityAlerts: [
      "GET /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    codeownersErrors: ["GET /repos/{owner}/{repo}/codeowners/errors"],
    compareCommits: ["GET /repos/{owner}/{repo}/compare/{base}...{head}"],
    compareCommitsWithBasehead: [
      "GET /repos/{owner}/{repo}/compare/{basehead}"
    ],
    createAttestation: ["POST /repos/{owner}/{repo}/attestations"],
    createAutolink: ["POST /repos/{owner}/{repo}/autolinks"],
    createCommitComment: [
      "POST /repos/{owner}/{repo}/commits/{commit_sha}/comments"
    ],
    createCommitSignatureProtection: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    createCommitStatus: ["POST /repos/{owner}/{repo}/statuses/{sha}"],
    createDeployKey: ["POST /repos/{owner}/{repo}/keys"],
    createDeployment: ["POST /repos/{owner}/{repo}/deployments"],
    createDeploymentBranchPolicy: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies"
    ],
    createDeploymentProtectionRule: [
      "POST /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules"
    ],
    createDeploymentStatus: [
      "POST /repos/{owner}/{repo}/deployments/{deployment_id}/statuses"
    ],
    createDispatchEvent: ["POST /repos/{owner}/{repo}/dispatches"],
    createForAuthenticatedUser: ["POST /user/repos"],
    createFork: ["POST /repos/{owner}/{repo}/forks"],
    createInOrg: ["POST /orgs/{org}/repos"],
    createOrUpdateEnvironment: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    createOrUpdateFileContents: ["PUT /repos/{owner}/{repo}/contents/{path}"],
    createOrgRuleset: ["POST /orgs/{org}/rulesets"],
    createPagesDeployment: ["POST /repos/{owner}/{repo}/pages/deployments"],
    createPagesSite: ["POST /repos/{owner}/{repo}/pages"],
    createRelease: ["POST /repos/{owner}/{repo}/releases"],
    createRepoRuleset: ["POST /repos/{owner}/{repo}/rulesets"],
    createUsingTemplate: [
      "POST /repos/{template_owner}/{template_repo}/generate"
    ],
    createWebhook: ["POST /repos/{owner}/{repo}/hooks"],
    customPropertiesForReposCreateOrUpdateRepositoryValues: [
      "PATCH /repos/{owner}/{repo}/properties/values"
    ],
    customPropertiesForReposGetRepositoryValues: [
      "GET /repos/{owner}/{repo}/properties/values"
    ],
    declineInvitation: [
      "DELETE /user/repository_invitations/{invitation_id}",
      {},
      { renamed: ["repos", "declineInvitationForAuthenticatedUser"] }
    ],
    declineInvitationForAuthenticatedUser: [
      "DELETE /user/repository_invitations/{invitation_id}"
    ],
    delete: ["DELETE /repos/{owner}/{repo}"],
    deleteAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions"
    ],
    deleteAdminBranchProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    deleteAnEnvironment: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    deleteAutolink: ["DELETE /repos/{owner}/{repo}/autolinks/{autolink_id}"],
    deleteBranchProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    deleteCommitComment: ["DELETE /repos/{owner}/{repo}/comments/{comment_id}"],
    deleteCommitSignatureProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    deleteDeployKey: ["DELETE /repos/{owner}/{repo}/keys/{key_id}"],
    deleteDeployment: [
      "DELETE /repos/{owner}/{repo}/deployments/{deployment_id}"
    ],
    deleteDeploymentBranchPolicy: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    deleteFile: ["DELETE /repos/{owner}/{repo}/contents/{path}"],
    deleteInvitation: [
      "DELETE /repos/{owner}/{repo}/invitations/{invitation_id}"
    ],
    deleteOrgRuleset: ["DELETE /orgs/{org}/rulesets/{ruleset_id}"],
    deletePagesSite: ["DELETE /repos/{owner}/{repo}/pages"],
    deletePullRequestReviewProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    deleteRelease: ["DELETE /repos/{owner}/{repo}/releases/{release_id}"],
    deleteReleaseAsset: [
      "DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}"
    ],
    deleteRepoRuleset: ["DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    deleteWebhook: ["DELETE /repos/{owner}/{repo}/hooks/{hook_id}"],
    disableAutomatedSecurityFixes: [
      "DELETE /repos/{owner}/{repo}/automated-security-fixes"
    ],
    disableDeploymentProtectionRule: [
      "DELETE /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}"
    ],
    disableImmutableReleases: [
      "DELETE /repos/{owner}/{repo}/immutable-releases"
    ],
    disablePrivateVulnerabilityReporting: [
      "DELETE /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    disableVulnerabilityAlerts: [
      "DELETE /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    downloadArchive: [
      "GET /repos/{owner}/{repo}/zipball/{ref}",
      {},
      { renamed: ["repos", "downloadZipballArchive"] }
    ],
    downloadTarballArchive: ["GET /repos/{owner}/{repo}/tarball/{ref}"],
    downloadZipballArchive: ["GET /repos/{owner}/{repo}/zipball/{ref}"],
    enableAutomatedSecurityFixes: [
      "PUT /repos/{owner}/{repo}/automated-security-fixes"
    ],
    enableImmutableReleases: ["PUT /repos/{owner}/{repo}/immutable-releases"],
    enablePrivateVulnerabilityReporting: [
      "PUT /repos/{owner}/{repo}/private-vulnerability-reporting"
    ],
    enableVulnerabilityAlerts: [
      "PUT /repos/{owner}/{repo}/vulnerability-alerts"
    ],
    generateReleaseNotes: [
      "POST /repos/{owner}/{repo}/releases/generate-notes"
    ],
    get: ["GET /repos/{owner}/{repo}"],
    getAccessRestrictions: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions"
    ],
    getAdminBranchProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    getAllDeploymentProtectionRules: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules"
    ],
    getAllEnvironments: ["GET /repos/{owner}/{repo}/environments"],
    getAllStatusCheckContexts: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts"
    ],
    getAllTopics: ["GET /repos/{owner}/{repo}/topics"],
    getAppsWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps"
    ],
    getAutolink: ["GET /repos/{owner}/{repo}/autolinks/{autolink_id}"],
    getBranch: ["GET /repos/{owner}/{repo}/branches/{branch}"],
    getBranchProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    getBranchRules: ["GET /repos/{owner}/{repo}/rules/branches/{branch}"],
    getClones: ["GET /repos/{owner}/{repo}/traffic/clones"],
    getCodeFrequencyStats: ["GET /repos/{owner}/{repo}/stats/code_frequency"],
    getCollaboratorPermissionLevel: [
      "GET /repos/{owner}/{repo}/collaborators/{username}/permission"
    ],
    getCombinedStatusForRef: ["GET /repos/{owner}/{repo}/commits/{ref}/status"],
    getCommit: ["GET /repos/{owner}/{repo}/commits/{ref}"],
    getCommitActivityStats: ["GET /repos/{owner}/{repo}/stats/commit_activity"],
    getCommitComment: ["GET /repos/{owner}/{repo}/comments/{comment_id}"],
    getCommitSignatureProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures"
    ],
    getCommunityProfileMetrics: ["GET /repos/{owner}/{repo}/community/profile"],
    getContent: ["GET /repos/{owner}/{repo}/contents/{path}"],
    getContributorsStats: ["GET /repos/{owner}/{repo}/stats/contributors"],
    getCustomDeploymentProtectionRule: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/{protection_rule_id}"
    ],
    getDeployKey: ["GET /repos/{owner}/{repo}/keys/{key_id}"],
    getDeployment: ["GET /repos/{owner}/{repo}/deployments/{deployment_id}"],
    getDeploymentBranchPolicy: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    getDeploymentStatus: [
      "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses/{status_id}"
    ],
    getEnvironment: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}"
    ],
    getLatestPagesBuild: ["GET /repos/{owner}/{repo}/pages/builds/latest"],
    getLatestRelease: ["GET /repos/{owner}/{repo}/releases/latest"],
    getOrgRuleSuite: ["GET /orgs/{org}/rulesets/rule-suites/{rule_suite_id}"],
    getOrgRuleSuites: ["GET /orgs/{org}/rulesets/rule-suites"],
    getOrgRuleset: ["GET /orgs/{org}/rulesets/{ruleset_id}"],
    getOrgRulesets: ["GET /orgs/{org}/rulesets"],
    getPages: ["GET /repos/{owner}/{repo}/pages"],
    getPagesBuild: ["GET /repos/{owner}/{repo}/pages/builds/{build_id}"],
    getPagesDeployment: [
      "GET /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}"
    ],
    getPagesHealthCheck: ["GET /repos/{owner}/{repo}/pages/health"],
    getParticipationStats: ["GET /repos/{owner}/{repo}/stats/participation"],
    getPullRequestReviewProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    getPunchCardStats: ["GET /repos/{owner}/{repo}/stats/punch_card"],
    getReadme: ["GET /repos/{owner}/{repo}/readme"],
    getReadmeInDirectory: ["GET /repos/{owner}/{repo}/readme/{dir}"],
    getRelease: ["GET /repos/{owner}/{repo}/releases/{release_id}"],
    getReleaseAsset: ["GET /repos/{owner}/{repo}/releases/assets/{asset_id}"],
    getReleaseByTag: ["GET /repos/{owner}/{repo}/releases/tags/{tag}"],
    getRepoRuleSuite: [
      "GET /repos/{owner}/{repo}/rulesets/rule-suites/{rule_suite_id}"
    ],
    getRepoRuleSuites: ["GET /repos/{owner}/{repo}/rulesets/rule-suites"],
    getRepoRuleset: ["GET /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    getRepoRulesetHistory: [
      "GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history"
    ],
    getRepoRulesetVersion: [
      "GET /repos/{owner}/{repo}/rulesets/{ruleset_id}/history/{version_id}"
    ],
    getRepoRulesets: ["GET /repos/{owner}/{repo}/rulesets"],
    getStatusChecksProtection: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    getTeamsWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams"
    ],
    getTopPaths: ["GET /repos/{owner}/{repo}/traffic/popular/paths"],
    getTopReferrers: ["GET /repos/{owner}/{repo}/traffic/popular/referrers"],
    getUsersWithAccessToProtectedBranch: [
      "GET /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users"
    ],
    getViews: ["GET /repos/{owner}/{repo}/traffic/views"],
    getWebhook: ["GET /repos/{owner}/{repo}/hooks/{hook_id}"],
    getWebhookConfigForRepo: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/config"
    ],
    getWebhookDelivery: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}"
    ],
    listActivities: ["GET /repos/{owner}/{repo}/activity"],
    listAttestations: [
      "GET /repos/{owner}/{repo}/attestations/{subject_digest}"
    ],
    listAutolinks: ["GET /repos/{owner}/{repo}/autolinks"],
    listBranches: ["GET /repos/{owner}/{repo}/branches"],
    listBranchesForHeadCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/branches-where-head"
    ],
    listCollaborators: ["GET /repos/{owner}/{repo}/collaborators"],
    listCommentsForCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/comments"
    ],
    listCommitCommentsForRepo: ["GET /repos/{owner}/{repo}/comments"],
    listCommitStatusesForRef: [
      "GET /repos/{owner}/{repo}/commits/{ref}/statuses"
    ],
    listCommits: ["GET /repos/{owner}/{repo}/commits"],
    listContributors: ["GET /repos/{owner}/{repo}/contributors"],
    listCustomDeploymentRuleIntegrations: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment_protection_rules/apps"
    ],
    listDeployKeys: ["GET /repos/{owner}/{repo}/keys"],
    listDeploymentBranchPolicies: [
      "GET /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies"
    ],
    listDeploymentStatuses: [
      "GET /repos/{owner}/{repo}/deployments/{deployment_id}/statuses"
    ],
    listDeployments: ["GET /repos/{owner}/{repo}/deployments"],
    listForAuthenticatedUser: ["GET /user/repos"],
    listForOrg: ["GET /orgs/{org}/repos"],
    listForUser: ["GET /users/{username}/repos"],
    listForks: ["GET /repos/{owner}/{repo}/forks"],
    listInvitations: ["GET /repos/{owner}/{repo}/invitations"],
    listInvitationsForAuthenticatedUser: ["GET /user/repository_invitations"],
    listLanguages: ["GET /repos/{owner}/{repo}/languages"],
    listPagesBuilds: ["GET /repos/{owner}/{repo}/pages/builds"],
    listPublic: ["GET /repositories"],
    listPullRequestsAssociatedWithCommit: [
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls"
    ],
    listReleaseAssets: [
      "GET /repos/{owner}/{repo}/releases/{release_id}/assets"
    ],
    listReleases: ["GET /repos/{owner}/{repo}/releases"],
    listTags: ["GET /repos/{owner}/{repo}/tags"],
    listTeams: ["GET /repos/{owner}/{repo}/teams"],
    listWebhookDeliveries: [
      "GET /repos/{owner}/{repo}/hooks/{hook_id}/deliveries"
    ],
    listWebhooks: ["GET /repos/{owner}/{repo}/hooks"],
    merge: ["POST /repos/{owner}/{repo}/merges"],
    mergeUpstream: ["POST /repos/{owner}/{repo}/merge-upstream"],
    pingWebhook: ["POST /repos/{owner}/{repo}/hooks/{hook_id}/pings"],
    redeliverWebhookDelivery: [
      "POST /repos/{owner}/{repo}/hooks/{hook_id}/deliveries/{delivery_id}/attempts"
    ],
    removeAppAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    removeCollaborator: [
      "DELETE /repos/{owner}/{repo}/collaborators/{username}"
    ],
    removeStatusCheckContexts: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    removeStatusCheckProtection: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    removeTeamAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    removeUserAccessRestrictions: [
      "DELETE /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    renameBranch: ["POST /repos/{owner}/{repo}/branches/{branch}/rename"],
    replaceAllTopics: ["PUT /repos/{owner}/{repo}/topics"],
    requestPagesBuild: ["POST /repos/{owner}/{repo}/pages/builds"],
    setAdminBranchProtection: [
      "POST /repos/{owner}/{repo}/branches/{branch}/protection/enforce_admins"
    ],
    setAppAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/apps",
      {},
      { mapToData: "apps" }
    ],
    setStatusCheckContexts: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks/contexts",
      {},
      { mapToData: "contexts" }
    ],
    setTeamAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/teams",
      {},
      { mapToData: "teams" }
    ],
    setUserAccessRestrictions: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection/restrictions/users",
      {},
      { mapToData: "users" }
    ],
    testPushWebhook: ["POST /repos/{owner}/{repo}/hooks/{hook_id}/tests"],
    transfer: ["POST /repos/{owner}/{repo}/transfer"],
    update: ["PATCH /repos/{owner}/{repo}"],
    updateBranchProtection: [
      "PUT /repos/{owner}/{repo}/branches/{branch}/protection"
    ],
    updateCommitComment: ["PATCH /repos/{owner}/{repo}/comments/{comment_id}"],
    updateDeploymentBranchPolicy: [
      "PUT /repos/{owner}/{repo}/environments/{environment_name}/deployment-branch-policies/{branch_policy_id}"
    ],
    updateInformationAboutPagesSite: ["PUT /repos/{owner}/{repo}/pages"],
    updateInvitation: [
      "PATCH /repos/{owner}/{repo}/invitations/{invitation_id}"
    ],
    updateOrgRuleset: ["PUT /orgs/{org}/rulesets/{ruleset_id}"],
    updatePullRequestReviewProtection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews"
    ],
    updateRelease: ["PATCH /repos/{owner}/{repo}/releases/{release_id}"],
    updateReleaseAsset: [
      "PATCH /repos/{owner}/{repo}/releases/assets/{asset_id}"
    ],
    updateRepoRuleset: ["PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}"],
    updateStatusCheckPotection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks",
      {},
      { renamed: ["repos", "updateStatusCheckProtection"] }
    ],
    updateStatusCheckProtection: [
      "PATCH /repos/{owner}/{repo}/branches/{branch}/protection/required_status_checks"
    ],
    updateWebhook: ["PATCH /repos/{owner}/{repo}/hooks/{hook_id}"],
    updateWebhookConfigForRepo: [
      "PATCH /repos/{owner}/{repo}/hooks/{hook_id}/config"
    ],
    uploadReleaseAsset: [
      "POST /repos/{owner}/{repo}/releases/{release_id}/assets{?name,label}",
      { baseUrl: "https://uploads.github.com" }
    ]
  },
  search: {
    code: ["GET /search/code"],
    commits: ["GET /search/commits"],
    issuesAndPullRequests: ["GET /search/issues"],
    labels: ["GET /search/labels"],
    repos: ["GET /search/repositories"],
    topics: ["GET /search/topics"],
    users: ["GET /search/users"]
  },
  secretScanning: {
    createPushProtectionBypass: [
      "POST /repos/{owner}/{repo}/secret-scanning/push-protection-bypasses"
    ],
    getAlert: [
      "GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}"
    ],
    getScanHistory: ["GET /repos/{owner}/{repo}/secret-scanning/scan-history"],
    listAlertsForOrg: ["GET /orgs/{org}/secret-scanning/alerts"],
    listAlertsForRepo: ["GET /repos/{owner}/{repo}/secret-scanning/alerts"],
    listLocationsForAlert: [
      "GET /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}/locations"
    ],
    listOrgPatternConfigs: [
      "GET /orgs/{org}/secret-scanning/pattern-configurations"
    ],
    updateAlert: [
      "PATCH /repos/{owner}/{repo}/secret-scanning/alerts/{alert_number}"
    ],
    updateOrgPatternConfigs: [
      "PATCH /orgs/{org}/secret-scanning/pattern-configurations"
    ]
  },
  securityAdvisories: {
    createFork: [
      "POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/forks"
    ],
    createPrivateVulnerabilityReport: [
      "POST /repos/{owner}/{repo}/security-advisories/reports"
    ],
    createRepositoryAdvisory: [
      "POST /repos/{owner}/{repo}/security-advisories"
    ],
    createRepositoryAdvisoryCveRequest: [
      "POST /repos/{owner}/{repo}/security-advisories/{ghsa_id}/cve"
    ],
    getGlobalAdvisory: ["GET /advisories/{ghsa_id}"],
    getRepositoryAdvisory: [
      "GET /repos/{owner}/{repo}/security-advisories/{ghsa_id}"
    ],
    listGlobalAdvisories: ["GET /advisories"],
    listOrgRepositoryAdvisories: ["GET /orgs/{org}/security-advisories"],
    listRepositoryAdvisories: ["GET /repos/{owner}/{repo}/security-advisories"],
    updateRepositoryAdvisory: [
      "PATCH /repos/{owner}/{repo}/security-advisories/{ghsa_id}"
    ]
  },
  teams: {
    addOrUpdateMembershipForUserInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    addOrUpdateRepoPermissionsInOrg: [
      "PUT /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    checkPermissionsForRepoInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    create: ["POST /orgs/{org}/teams"],
    createDiscussionCommentInOrg: [
      "POST /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments"
    ],
    createDiscussionInOrg: ["POST /orgs/{org}/teams/{team_slug}/discussions"],
    deleteDiscussionCommentInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    deleteDiscussionInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    deleteInOrg: ["DELETE /orgs/{org}/teams/{team_slug}"],
    getByName: ["GET /orgs/{org}/teams/{team_slug}"],
    getDiscussionCommentInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    getDiscussionInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    getMembershipForUserInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    list: ["GET /orgs/{org}/teams"],
    listChildInOrg: ["GET /orgs/{org}/teams/{team_slug}/teams"],
    listDiscussionCommentsInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments"
    ],
    listDiscussionsInOrg: ["GET /orgs/{org}/teams/{team_slug}/discussions"],
    listForAuthenticatedUser: ["GET /user/teams"],
    listMembersInOrg: ["GET /orgs/{org}/teams/{team_slug}/members"],
    listPendingInvitationsInOrg: [
      "GET /orgs/{org}/teams/{team_slug}/invitations"
    ],
    listReposInOrg: ["GET /orgs/{org}/teams/{team_slug}/repos"],
    removeMembershipForUserInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/memberships/{username}"
    ],
    removeRepoInOrg: [
      "DELETE /orgs/{org}/teams/{team_slug}/repos/{owner}/{repo}"
    ],
    updateDiscussionCommentInOrg: [
      "PATCH /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}/comments/{comment_number}"
    ],
    updateDiscussionInOrg: [
      "PATCH /orgs/{org}/teams/{team_slug}/discussions/{discussion_number}"
    ],
    updateInOrg: ["PATCH /orgs/{org}/teams/{team_slug}"]
  },
  users: {
    addEmailForAuthenticated: [
      "POST /user/emails",
      {},
      { renamed: ["users", "addEmailForAuthenticatedUser"] }
    ],
    addEmailForAuthenticatedUser: ["POST /user/emails"],
    addSocialAccountForAuthenticatedUser: ["POST /user/social_accounts"],
    block: ["PUT /user/blocks/{username}"],
    checkBlocked: ["GET /user/blocks/{username}"],
    checkFollowingForUser: ["GET /users/{username}/following/{target_user}"],
    checkPersonIsFollowedByAuthenticated: ["GET /user/following/{username}"],
    createGpgKeyForAuthenticated: [
      "POST /user/gpg_keys",
      {},
      { renamed: ["users", "createGpgKeyForAuthenticatedUser"] }
    ],
    createGpgKeyForAuthenticatedUser: ["POST /user/gpg_keys"],
    createPublicSshKeyForAuthenticated: [
      "POST /user/keys",
      {},
      { renamed: ["users", "createPublicSshKeyForAuthenticatedUser"] }
    ],
    createPublicSshKeyForAuthenticatedUser: ["POST /user/keys"],
    createSshSigningKeyForAuthenticatedUser: ["POST /user/ssh_signing_keys"],
    deleteAttestationsBulk: [
      "POST /users/{username}/attestations/delete-request"
    ],
    deleteAttestationsById: [
      "DELETE /users/{username}/attestations/{attestation_id}"
    ],
    deleteAttestationsBySubjectDigest: [
      "DELETE /users/{username}/attestations/digest/{subject_digest}"
    ],
    deleteEmailForAuthenticated: [
      "DELETE /user/emails",
      {},
      { renamed: ["users", "deleteEmailForAuthenticatedUser"] }
    ],
    deleteEmailForAuthenticatedUser: ["DELETE /user/emails"],
    deleteGpgKeyForAuthenticated: [
      "DELETE /user/gpg_keys/{gpg_key_id}",
      {},
      { renamed: ["users", "deleteGpgKeyForAuthenticatedUser"] }
    ],
    deleteGpgKeyForAuthenticatedUser: ["DELETE /user/gpg_keys/{gpg_key_id}"],
    deletePublicSshKeyForAuthenticated: [
      "DELETE /user/keys/{key_id}",
      {},
      { renamed: ["users", "deletePublicSshKeyForAuthenticatedUser"] }
    ],
    deletePublicSshKeyForAuthenticatedUser: ["DELETE /user/keys/{key_id}"],
    deleteSocialAccountForAuthenticatedUser: ["DELETE /user/social_accounts"],
    deleteSshSigningKeyForAuthenticatedUser: [
      "DELETE /user/ssh_signing_keys/{ssh_signing_key_id}"
    ],
    follow: ["PUT /user/following/{username}"],
    getAuthenticated: ["GET /user"],
    getById: ["GET /user/{account_id}"],
    getByUsername: ["GET /users/{username}"],
    getContextForUser: ["GET /users/{username}/hovercard"],
    getGpgKeyForAuthenticated: [
      "GET /user/gpg_keys/{gpg_key_id}",
      {},
      { renamed: ["users", "getGpgKeyForAuthenticatedUser"] }
    ],
    getGpgKeyForAuthenticatedUser: ["GET /user/gpg_keys/{gpg_key_id}"],
    getPublicSshKeyForAuthenticated: [
      "GET /user/keys/{key_id}",
      {},
      { renamed: ["users", "getPublicSshKeyForAuthenticatedUser"] }
    ],
    getPublicSshKeyForAuthenticatedUser: ["GET /user/keys/{key_id}"],
    getSshSigningKeyForAuthenticatedUser: [
      "GET /user/ssh_signing_keys/{ssh_signing_key_id}"
    ],
    list: ["GET /users"],
    listAttestations: ["GET /users/{username}/attestations/{subject_digest}"],
    listAttestationsBulk: [
      "POST /users/{username}/attestations/bulk-list{?per_page,before,after}"
    ],
    listBlockedByAuthenticated: [
      "GET /user/blocks",
      {},
      { renamed: ["users", "listBlockedByAuthenticatedUser"] }
    ],
    listBlockedByAuthenticatedUser: ["GET /user/blocks"],
    listEmailsForAuthenticated: [
      "GET /user/emails",
      {},
      { renamed: ["users", "listEmailsForAuthenticatedUser"] }
    ],
    listEmailsForAuthenticatedUser: ["GET /user/emails"],
    listFollowedByAuthenticated: [
      "GET /user/following",
      {},
      { renamed: ["users", "listFollowedByAuthenticatedUser"] }
    ],
    listFollowedByAuthenticatedUser: ["GET /user/following"],
    listFollowersForAuthenticatedUser: ["GET /user/followers"],
    listFollowersForUser: ["GET /users/{username}/followers"],
    listFollowingForUser: ["GET /users/{username}/following"],
    listGpgKeysForAuthenticated: [
      "GET /user/gpg_keys",
      {},
      { renamed: ["users", "listGpgKeysForAuthenticatedUser"] }
    ],
    listGpgKeysForAuthenticatedUser: ["GET /user/gpg_keys"],
    listGpgKeysForUser: ["GET /users/{username}/gpg_keys"],
    listPublicEmailsForAuthenticated: [
      "GET /user/public_emails",
      {},
      { renamed: ["users", "listPublicEmailsForAuthenticatedUser"] }
    ],
    listPublicEmailsForAuthenticatedUser: ["GET /user/public_emails"],
    listPublicKeysForUser: ["GET /users/{username}/keys"],
    listPublicSshKeysForAuthenticated: [
      "GET /user/keys",
      {},
      { renamed: ["users", "listPublicSshKeysForAuthenticatedUser"] }
    ],
    listPublicSshKeysForAuthenticatedUser: ["GET /user/keys"],
    listSocialAccountsForAuthenticatedUser: ["GET /user/social_accounts"],
    listSocialAccountsForUser: ["GET /users/{username}/social_accounts"],
    listSshSigningKeysForAuthenticatedUser: ["GET /user/ssh_signing_keys"],
    listSshSigningKeysForUser: ["GET /users/{username}/ssh_signing_keys"],
    setPrimaryEmailVisibilityForAuthenticated: [
      "PATCH /user/email/visibility",
      {},
      { renamed: ["users", "setPrimaryEmailVisibilityForAuthenticatedUser"] }
    ],
    setPrimaryEmailVisibilityForAuthenticatedUser: [
      "PATCH /user/email/visibility"
    ],
    unblock: ["DELETE /user/blocks/{username}"],
    unfollow: ["DELETE /user/following/{username}"],
    updateAuthenticated: ["PATCH /user"]
  }
};
var endpoints_default = Endpoints;

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/endpoints-to-methods.js
var endpointMethodsMap = /* @__PURE__ */ new Map();
for (const [scope, endpoints] of Object.entries(endpoints_default)) {
  for (const [methodName, endpoint2] of Object.entries(endpoints)) {
    const [route, defaults, decorations] = endpoint2;
    const [method, url] = route.split(/ /);
    const endpointDefaults = Object.assign(
      {
        method,
        url
      },
      defaults
    );
    if (!endpointMethodsMap.has(scope)) {
      endpointMethodsMap.set(scope, /* @__PURE__ */ new Map());
    }
    endpointMethodsMap.get(scope).set(methodName, {
      scope,
      methodName,
      endpointDefaults,
      decorations
    });
  }
}
var handler = {
  has({ scope }, methodName) {
    return endpointMethodsMap.get(scope).has(methodName);
  },
  getOwnPropertyDescriptor(target, methodName) {
    return {
      value: this.get(target, methodName),
      // ensures method is in the cache
      configurable: true,
      writable: true,
      enumerable: true
    };
  },
  defineProperty(target, methodName, descriptor) {
    Object.defineProperty(target.cache, methodName, descriptor);
    return true;
  },
  deleteProperty(target, methodName) {
    delete target.cache[methodName];
    return true;
  },
  ownKeys({ scope }) {
    return [...endpointMethodsMap.get(scope).keys()];
  },
  set(target, methodName, value) {
    return target.cache[methodName] = value;
  },
  get({ octokit, scope, cache }, methodName) {
    if (cache[methodName]) {
      return cache[methodName];
    }
    const method = endpointMethodsMap.get(scope).get(methodName);
    if (!method) {
      return void 0;
    }
    const { endpointDefaults, decorations } = method;
    if (decorations) {
      cache[methodName] = decorate(
        octokit,
        scope,
        methodName,
        endpointDefaults,
        decorations
      );
    } else {
      cache[methodName] = octokit.request.defaults(endpointDefaults);
    }
    return cache[methodName];
  }
};
function endpointsToMethods(octokit) {
  const newMethods = {};
  for (const scope of endpointMethodsMap.keys()) {
    newMethods[scope] = new Proxy({ octokit, scope, cache: {} }, handler);
  }
  return newMethods;
}
function decorate(octokit, scope, methodName, defaults, decorations) {
  const requestWithDefaults = octokit.request.defaults(defaults);
  function withDecorations(...args) {
    let options = requestWithDefaults.endpoint.merge(...args);
    if (decorations.mapToData) {
      options = Object.assign({}, options, {
        data: options[decorations.mapToData],
        [decorations.mapToData]: void 0
      });
      return requestWithDefaults(options);
    }
    if (decorations.renamed) {
      const [newScope, newMethodName] = decorations.renamed;
      octokit.log.warn(
        `octokit.${scope}.${methodName}() has been renamed to octokit.${newScope}.${newMethodName}()`
      );
    }
    if (decorations.deprecated) {
      octokit.log.warn(decorations.deprecated);
    }
    if (decorations.renamedParameters) {
      const options2 = requestWithDefaults.endpoint.merge(...args);
      for (const [name, alias] of Object.entries(
        decorations.renamedParameters
      )) {
        if (name in options2) {
          octokit.log.warn(
            `"${name}" parameter is deprecated for "octokit.${scope}.${methodName}()". Use "${alias}" instead`
          );
          if (!(alias in options2)) {
            options2[alias] = options2[name];
          }
          delete options2[name];
        }
      }
      return requestWithDefaults(options2);
    }
    return requestWithDefaults(...args);
  }
  return Object.assign(withDecorations, requestWithDefaults);
}

// node_modules/@octokit/plugin-rest-endpoint-methods/dist-src/index.js
function restEndpointMethods(octokit) {
  const api = endpointsToMethods(octokit);
  return {
    rest: api
  };
}
restEndpointMethods.VERSION = VERSION5;
function legacyRestEndpointMethods(octokit) {
  const api = endpointsToMethods(octokit);
  return {
    ...api,
    rest: api
  };
}
legacyRestEndpointMethods.VERSION = VERSION5;

// node_modules/@octokit/plugin-paginate-rest/dist-bundle/index.js
var VERSION6 = "0.0.0-development";
function normalizePaginatedListResponse(response) {
  if (!response.data) {
    return {
      ...response,
      data: []
    };
  }
  const responseNeedsNormalization = ("total_count" in response.data || "total_commits" in response.data) && !("url" in response.data);
  if (!responseNeedsNormalization) return response;
  const incompleteResults = response.data.incomplete_results;
  const repositorySelection = response.data.repository_selection;
  const totalCount = response.data.total_count;
  const totalCommits = response.data.total_commits;
  delete response.data.incomplete_results;
  delete response.data.repository_selection;
  delete response.data.total_count;
  delete response.data.total_commits;
  const namespaceKey = Object.keys(response.data)[0];
  const data = response.data[namespaceKey];
  response.data = data;
  if (typeof incompleteResults !== "undefined") {
    response.data.incomplete_results = incompleteResults;
  }
  if (typeof repositorySelection !== "undefined") {
    response.data.repository_selection = repositorySelection;
  }
  response.data.total_count = totalCount;
  response.data.total_commits = totalCommits;
  return response;
}
function iterator(octokit, route, parameters) {
  const options = typeof route === "function" ? route.endpoint(parameters) : octokit.request.endpoint(route, parameters);
  const requestMethod = typeof route === "function" ? route : octokit.request;
  const method = options.method;
  const headers = options.headers;
  let url = options.url;
  return {
    [Symbol.asyncIterator]: () => ({
      async next() {
        if (!url) return { done: true };
        try {
          const response = await requestMethod({ method, url, headers });
          const normalizedResponse = normalizePaginatedListResponse(response);
          url = ((normalizedResponse.headers.link || "").match(
            /<([^<>]+)>;\s*rel="next"/
          ) || [])[1];
          if (!url && "total_commits" in normalizedResponse.data) {
            const parsedUrl = new URL(normalizedResponse.url);
            const params = parsedUrl.searchParams;
            const page = parseInt(params.get("page") || "1", 10);
            const per_page = parseInt(params.get("per_page") || "250", 10);
            if (page * per_page < normalizedResponse.data.total_commits) {
              params.set("page", String(page + 1));
              url = parsedUrl.toString();
            }
          }
          return { value: normalizedResponse };
        } catch (error) {
          if (error.status !== 409) throw error;
          url = "";
          return {
            value: {
              status: 200,
              headers: {},
              data: []
            }
          };
        }
      }
    })
  };
}
function paginate(octokit, route, parameters, mapFn) {
  if (typeof parameters === "function") {
    mapFn = parameters;
    parameters = void 0;
  }
  return gather(
    octokit,
    [],
    iterator(octokit, route, parameters)[Symbol.asyncIterator](),
    mapFn
  );
}
function gather(octokit, results, iterator2, mapFn) {
  return iterator2.next().then((result) => {
    if (result.done) {
      return results;
    }
    let earlyExit = false;
    function done() {
      earlyExit = true;
    }
    results = results.concat(
      mapFn ? mapFn(result.value, done) : result.value.data
    );
    if (earlyExit) {
      return results;
    }
    return gather(octokit, results, iterator2, mapFn);
  });
}
var composePaginateRest = Object.assign(paginate, {
  iterator
});
function paginateRest(octokit) {
  return {
    paginate: Object.assign(paginate.bind(null, octokit), {
      iterator: iterator.bind(null, octokit)
    })
  };
}
paginateRest.VERSION = VERSION6;

// src/action/octokit.ts
var ActionOctokit = Octokit.plugin(restEndpointMethods, paginateRest);
function createOctokit(token) {
  return new ActionOctokit({ auth: token });
}
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required`);
    process.exit(1);
  }
  return value;
}
function repoFromEnv() {
  const [owner, repo] = requireEnv("GITHUB_REPOSITORY").split("/");
  return { owner, repo };
}
function readEventPayload() {
  return JSON.parse(fs.readFileSync(requireEnv("GITHUB_EVENT_PATH"), "utf8"));
}

// src/action/publish.ts
async function prBelongsToRun(octokit, owner, repo, prNumber, checkSuiteNodeId) {
  const result = await octokit.graphql(
    `query($owner:String!, $repo:String!, $prNumber:Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $prNumber) {
          commits(last: 1) {
            nodes { commit { checkSuites(first: 10) { nodes { id } } } }
          }
        }
      }
    }`,
    { owner, repo, prNumber }
  );
  const commit = result.repository.pullRequest?.commits.nodes[0]?.commit;
  return commit?.checkSuites.nodes.some(({ id }) => id === checkSuiteNodeId) ?? false;
}
function loadRenderResult(inDir) {
  const manifestPath = path.join(inDir, "manifest.json");
  if (!fs2.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs2.readFileSync(manifestPath, "utf8"));
  return {
    manifest,
    result: {
      truncated: manifest.truncated,
      files: manifest.files.map((file) => ({
        path: file.path,
        note: file.note,
        failed: file.failed,
        svg: file.svgFile ? fs2.readFileSync(path.join(inDir, file.svgFile), "utf8") : void 0
      }))
    }
  };
}
async function runPublish(token, fileHouseKey, inDir) {
  const { owner, repo } = repoFromEnv();
  const event = readEventPayload();
  const loaded = loadRenderResult(inDir);
  if (!loaded) {
    console.log("no manifest in artifact, nothing to publish");
    return;
  }
  const { manifest, result } = loaded;
  const octokit = createOctokit(token);
  const valid = await prBelongsToRun(
    octokit,
    owner,
    repo,
    manifest.prNumber,
    event.workflow_run.check_suite_node_id
  );
  if (!valid) {
    console.error(
      `PR #${manifest.prNumber} does not belong to check suite ${event.workflow_run.check_suite_node_id}, refusing to comment`
    );
    process.exit(1);
  }
  const client = new OctokitGithubClient(
    octokit
  );
  await publishDiffComment(
    client,
    new FileHouseImageHost(fileHouseKey),
    { owner, repo, prNumber: manifest.prNumber },
    result
  );
  console.log(`published diff comment on #${manifest.prNumber}`);
}

// src/action/render.ts
var fs3 = __toESM(require("fs"));
var path2 = __toESM(require("path"));
async function runRender(token, outDir) {
  const { owner, repo } = repoFromEnv();
  const event = readEventPayload();
  const client = new OctokitGithubClient(
    createOctokit(token)
  );
  const result = await renderPullRequestDiffs(client, {
    owner,
    repo,
    prNumber: event.pull_request.number,
    baseSha: event.pull_request.base.sha,
    headSha: event.pull_request.head.sha
  });
  fs3.mkdirSync(outDir, { recursive: true });
  const manifest = {
    prNumber: event.pull_request.number,
    truncated: result.truncated,
    files: result.files.map((file, index) => {
      if (!file.svg) return { path: file.path, note: file.note, failed: file.failed };
      const svgFile = `${index}.svg`;
      fs3.writeFileSync(path2.join(outDir, svgFile), file.svg);
      return { path: file.path, svgFile };
    })
  };
  fs3.writeFileSync(path2.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`rendered ${manifest.files.length} tree(s) to ${outDir}`);
}

// src/action/index.ts
async function main() {
  const mode = requireInput("mode");
  const token = requireInput("token");
  const directory = getInput("directory") || "bt-diff-out";
  switch (mode) {
    case "render":
      await runRender(token, directory);
      break;
    case "publish":
      await runPublish(token, requireInput("file-house-key"), directory);
      break;
    default:
      console.error(`unknown mode "${mode}", expected "render" or "publish"`);
      process.exit(1);
  }
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
/*! Bundled license information:

content-type/dist/index.js:
  (*!
   * content-type
   * Copyright(c) 2015 Douglas Christopher Wilson
   * MIT Licensed
   *)

@octokit/request-error/dist-src/index.js:
  (* v8 ignore else -- @preserve -- Bug with vitest coverage where it sees an else branch that doesn't exist *)

@octokit/request/dist-bundle/index.js:
  (* v8 ignore next -- @preserve *)
  (* v8 ignore else -- @preserve *)
*/
