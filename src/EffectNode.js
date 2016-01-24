import PluggableNode from './PluggableNode.js';
import Effect from './Effect.js';
import ShaderProgram from './ShaderProgram.js';
import {
  validateInputSpecs,
  identity,
  makeGlModel,
  shaderNameRegex,
  reservedNames,
  baseVertexShader,
  baseFragmentShader,
} from './utilities.js';

function addShaderName(node, shaderSrc) {
  if (shaderNameRegex.test(shaderSrc)) {
    return shaderSrc;
  }

  return `#define SHADER_NAME seriously.${node.hook}\n${shaderSrc}`;
}

export default class EffectNode extends PluggableNode {
  constructor(seriously, hook, options) {
    super(seriously);

    this.effectRef = seriously.Seriously.registry.effects[hook];
    this.sources = {};
    this.targets = [];
    this.inputElements = {};
    this.dirty = true;
    this.shaderDirty = true;
    this.hook = hook;
    this.options = options;
    this.transform = null;

    this.effect = Object.assign({}, this.effectRef);

    if (this.effectRef.definition) {
      /*
      TODO: copy over inputs object separately in case some are specified
      in advance and some are specified in definition function
      */
      Object.assign(this.effect, this.effectRef.definition.call(this, options));
    }

    validateInputSpecs(this.effect);

    this.uniforms.transform = identity;
    this.inputs = {};

    const defaults = seriously.defaultInputs[hook];
    const defaultSources = {};
    for (const name in this.effect.inputs) {
      if (this.effect.inputs.hasOwnProperty(name)) {
        const input = this.effect.inputs[name];

        if (input.defaultValue === undefined || input.defaultValue === null) {
          if (input.type === 'number') {
            input.defaultValue = Math.min(Math.max(0, input.min), input.max);
          } else if (input.type === 'color') {
            input.defaultValue = [0, 0, 0, 0];
          } else if (input.type === 'boolean') {
            input.defaultValue = false;
          } else if (input.type === 'string') {
            input.defaultValue = '';
          } else if (input.type === 'enum') {
            input.defaultValue = input.firstValue;
          }
        }

        let defaultValue = input.validate.call(this, input.defaultValue, input);
        if (defaults && defaults[name] !== undefined) {
          defaultValue = input.validate.call(
            this, defaults[name], input, input.defaultValue, defaultValue);
          defaults[name] = defaultValue;
          if (input.type === 'image') {
            defaultSources[name] = defaultValue;
          }
        }

        this.inputs[name] = defaultValue;
        if (input.uniform) {
          this.uniforms[input.uniform] = input.defaultValue;
        }
      }
    }

    if (seriously.gl) {
      this.initialize();
      if (this.effect.commonShader) {
        /*
        this effect is unlikely to need to be modified again
        by changing parameters, so build it now to avoid jank later
        */
        this.buildShader();
      }
    }

    this.updateReady();
    this.inPlace = this.effect.inPlace;

    this.pub = new Effect(this);

    seriously.nodes.push(this);
    seriously.nodesById[this.id] = this; // eslint-disable-line no-param-reassign
    seriously.effects.push(this);

    seriously.Seriously.registry.allEffectsByHook[hook].push(this);

    for (const name in defaultSources) {
      if (defaultSources.hasOwnProperty(name)) {
        this.setInput(name, defaultSources[name]);
      }
    }
  }

  initialize() {
    if (this.initialized) {
      return;
    }

    this.baseShader = this.seriously.baseShader;

    if (this.shape) {
      this.model = makeGlModel(this.shape, this.gl);
    } else {
      this.model = this.seriously.rectangleModel;
    }

    if (typeof this.effect.initialize === 'function') {
      this.effect.initialize.call(this, () => {
        this.initFrameBuffer(true);
      }, this.seriously.gl);
    } else {
      this.initFrameBuffer(true);
    }

    if (this.frameBuffer) {
      this.texture = this.frameBuffer.texture;
    }

    this.initialized = true;
  }

  resize() {
    super.resize();

    if (this.effect.resize) {
      this.effect.resize.call(this);
    }

    for (const target of this.targets) {
      target.resize();
    }
  }

  updateReady() {
    let ready = true;

    const effect = this.effect;
    for (const key in effect.inputs) {
      if (!effect.inputs.hasOwnProperty(key)) {
        continue;
      }
      const input = this.effect.inputs[key];
      if (input.type === 'image' &&
          (!this.sources[key] || !this.sources[key].ready) &&
          (!effect.requires || effect.requires.call(this, key, this.inputs))
          ) {
        ready = false;
        break;
      }
    }

    if (this.ready !== ready) {
      this.ready = ready;
      this.emit(ready ? 'ready' : 'unready');
      const method = ready ? 'setReady' : 'setUnready';

      if (this.targets) {
        for (const target of this.targets) {
          target[method]();
        }
      }
    }
  }

  setReady(...args) {
    return this.updateReady(...args);
  }

  setUnready(...args) {
    return this.updateReady(...args);
  }

  addTarget(target) {
    for (const aTarget in this.targets) {
      if (aTarget === target) {
        return;
      }
    }

    this.targets.push(target);
  }

  removeTarget(target) {
    const i = this.targets && this.targets.indexOf(target);
    if (i >= 0) {
      this.targets.splice(i, 1);
    }
  }

  removeSource(source) {
    const pub = source && source.pub;

    for (const i in this.inputs) {
      if (this.inputs.hasOwnProperty(i) &&
        (this.inputs[i] === source || this.inputs[i] === pub)) {
        this.inputs[i] = null;
      }
    }

    for (const i in this.sources) {
      if (this.sources.hasOwnProperty(i) &&
        (this.sources[i] === source || this.sources[i] === pub)) {
        this.sources[i] = null;
      }
    }
  }

  buildShader() {
    const effect = this.effect;

    if (this.shaderDirty) {
      if (effect.commonShader && this.seriously.commonShaders[this.hook]) {
        if (!this.shader) {
          this.seriously.commonShaders[this.hook].count++;
        }
        this.shader = this.seriously.commonShaders[this.hook].shader;
      } else if (effect.shader) {
        if (this.shader && !effect.commonShader) {
          this.shader.destroy();
        }
        const shader = effect.shader.call(this, this.inputs, {
          vertex: baseVertexShader,
          fragment: baseFragmentShader,
        }, this.seriously.Seriously.util);

        if (shader instanceof ShaderProgram) {
          this.shader = shader;
        } else if (shader && shader.vertex && shader.fragment) {
          this.shader = new ShaderProgram(
            this.seriously.gl,
            addShaderName(this, shader.vertex),
            addShaderName(this, shader.fragment)
          );
        } else {
          this.shader = this.seriously.baseShader;
        }

        if (effect.commonShader) {
          this.seriously.commonShaders[this.hook] = {
            count: 1,
            shader: this.shader,
          };
        }
      } else {
        this.shader = this.seriously.baseShader;
      }

      this.shaderDirty = false;
    }
  }

  render() {
    const effect = this.effect;

    const drawFn = (shader, model, uniforms, frameBuffer, node, options) => { // eslint-disable-line no-shadow, max-len
      this.seriously.draw(shader, model, uniforms, frameBuffer, node || this, options);
    };

    if (!this.seriously.gl) {
      return undefined;
    }

    if (!this.initialized) {
      this.initialize();
    }

    if (this.shaderDirty) {
      this.buildShader();
    }

    if (this.dirty && this.ready) {
      for (const key in this.sources) {
        if (!this.sources.hasOwnProperty(key)) {
          continue;
        }

        if (effect.requires && !effect.requires.call(this, key, this.inputs)) {
          continue;
        }

        // TODO: set source texture in case it changes?
        // sourcetexture = this.sources[i].render() || this.sources[i].texture

        const inPlace = typeof this.inPlace === 'function' ? this.inPlace(key) : this.inPlace;
        this.sources[key].render(!inPlace);
      }

      let frameBuffer;
      if (this.frameBuffer) {
        frameBuffer = this.frameBuffer.frameBuffer;
      }

      if (typeof effect.draw === 'function') {
        effect.draw.call(this, this.shader, this.model, this.uniforms, frameBuffer, drawFn);
        this.emit('render');
      } else if (frameBuffer) {
        this.seriously.draw(this.shader, this.model, this.uniforms, frameBuffer, this);
        this.emit('render');
      }

      this.dirty = false;
    }

    return this.texture;
  }

  setInput(name, value) {
    const me = this;

    function disconnectSource() {
      const previousSource = me.sources[name];

      /*
      remove this node from targets of previously connected source node,
      but only if the source node is not being used as another input
      */
      if (previousSource) {
        for (const key in me.sources) {
          if (key !== name &&
              me.sources.hasOwnProperty(key) &&
              me.sources[key] === previousSource) {
            return;
          }
        }
        previousSource.removeTarget(me);
      }
    }

    if (this.effect.inputs.hasOwnProperty(name)) {
      const input = this.effect.inputs[name];
      let uniform;
      if (input.type === 'image') {
        // && !(value instanceof Effect) && !(value instanceof Source)) {

        if (value) {
          value = this.seriously.findInputNode(value); // eslint-disable-line no-param-reassign

          if (value !== this.sources[name]) {
            disconnectSource();

            if (this.seriously.traceSources(value, this)) {
              throw new Error('Attempt to make cyclical connection.');
            }

            this.sources[name] = value;
            value.addTarget(this);
          }
        } else {
          delete this.sources[name];
          value = false; // eslint-disable-line no-param-reassign, max-len
        }

        uniform = this.sources[name];

        const sourceKeys = Object.keys(this.sources);
        if (this.inPlace === true && sourceKeys.length === 1) {
          const source = this.sources[sourceKeys[0]];
          this.uniforms.transform = source && source.cumulativeMatrix || identity;
        } else {
          this.uniforms.transform = identity;
        }
      } else {
        let defaultValue;
        if (this.seriously.defaultInputs[this.hook]
          && this.seriously.defaultInputs[this.hook][name] !== undefined) {
          defaultValue = this.seriously.defaultInputs[this.hook][name];
        } else {
          defaultValue = input.defaultValue;
        }
        value = input.validate.call(this, value, input, defaultValue, this.inputs[name]); // eslint-disable-line no-param-reassign, max-len
        uniform = value;
      }

      if (this.inputs[name] === value && input.type !== 'color' && input.type !== 'vector') {
        return value;
      }

      this.inputs[name] = value;

      if (input.uniform) {
        this.uniforms[input.uniform] = uniform;
      }

      if (input.type === 'image') {
        this.resize();
        this.updateReady();
      } else if (input.updateSources) {
        this.updateReady();
      }

      if (input.shaderDirty) {
        this.shaderDirty = true;
      }

      this.setDirty();

      if (input.update) {
        input.update.call(this, value);
      }

      return value;
    }
  }

  alias(inputName, aliasName) {
    if (reservedNames.indexOf(aliasName) >= 0) {
      throw new Error(`'${aliasName}' is a reserved name and cannot be used as an alias.`);
    }

    if (this.effect.inputs.hasOwnProperty(inputName)) {
      if (!aliasName) {
        aliasName = inputName; // eslint-disable-line no-param-reassign
      }

      this.seriously.removeAlias(aliasName);

      this.seriously.aliases[aliasName] = {
        node: this,
        input: inputName,
      };

      Object.defineProperty(this.seriously, aliasName, {
        configurable: true,
        enumerable: true,
        get: () => this.inputs[inputName],
        set: (value) => {  // eslint-disable-line arrow-body-style
          return this.setInput(inputName, value);
        },
      });
    }

    return this;
  }

  matte(poly) {
    var polys,
      polygons = [],
      polygon,
      vertices = [],
      i, j, v,
      vert, prev,
      //triangles = [],
      shape = {};

    //detect whether it's multiple polygons or what
    function makePolygonsArray(poly) {
      if (!poly || !poly.length || !Array.isArray(poly)) {
        return [];
      }

      if (!Array.isArray(poly[0])) {
        return [poly];
      }

      if (Array.isArray(poly[0]) && !isNaN(poly[0][0])) {
        return [poly];
      }

      return poly;
    }

    function linesIntersect(a1, a2, b1, b2) {
      /* eslint-disable camelcase */
      const ua_t = (b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x);
      const ub_t = (a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x);
      const u_b = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);
      if (u_b) {
        const ua = ua_t / u_b;
        const ub = ub_t / u_b;
        if (ua > 0 && ua <= 1 && ub > 0 && ub <= 1) {
          return {
            x: a1.x + ua * (a2.x - a1.x),
            y: a1.y + ua * (a2.y - a1.y),
          };
        }
      }
      return false;
      /* eslint-enable camelcase */
    }

    function makeSimple(poly) { // eslint-disable-line no-shadow
      /*
      this uses a slow, naive approach to detecting line intersections.
      Use Bentley-Ottmann Algorithm
      see: http://softsurfer.com/Archive/algorithm_0108/algorithm_0108.htm#Bentley-Ottmann Algorithm
      see: https://github.com/tokumine/sweepline
      */
      var i, j,
        edge1, edge2,
        intersect,
        intersections = [],
        newPoly,
        head, point,
        newPolygons,
        point1, point2;

      if (poly.simple) {
        return;
      }

      for (i = 0; i < poly.edges.length; i++) {
        edge1 = poly.edges[i];
        for (j = i + 1; j < poly.edges.length; j++) {
          edge2 = poly.edges[j];
          intersect = linesIntersect(edge1[0], edge1[1], edge2[0], edge2[1]);
          if (intersect) {
            intersect.edge1 = edge1;
            intersect.edge2 = edge2;
            intersections.push(intersect);
          }
        }
      }

      if (intersections.length) {
        newPolygons = [];

        for (i = 0; i < intersections.length; i++) {
          intersect = intersections[i];
          edge1 = intersect.edge1;
          edge2 = intersect.edge2;

          // make new points
          // TODO: set ids for points
          point1 = {
            x: intersect.x,
            y: intersect.y,
            prev: edge1[0],
            next: edge2[1],
            id: vertices.length,
          };
          poly.vertices.push(point1);
          vertices.push(point1);

          point2 = {
            x: intersect.x,
            y: intersect.y,
            prev: edge2[0],
            next: edge1[1],
            id: vertices.length,
          };
          poly.vertices.push(point2);
          vertices.push(point1);

          // modify old points
          point1.prev.next = point1;
          point1.next.prev = point1;
          point2.prev.next = point2;
          point2.next.prev = point2;

          // don't bother modifying the old edges. we're just gonna throw them out
        }

        // make new polygons
        do {
          newPoly = {
            edges: [],
            vertices: [],
            simple: true,
          };
          newPolygons.push(newPoly);
          point = poly.vertices[0];
          head = point;
          // while (point.next !== head && poly.vertices.length) {
          do {
            i = poly.vertices.indexOf(point);
            poly.vertices.splice(i, 1);
            newPoly.edges.push([point, point.next]);
            newPoly.vertices.push(point);
            point = point.next;
          } while (point !== head);
        } while (poly.vertices.length);

        // remove original polygon from list
        i = polygons.indexOf(poly);
        polygons.splice(i, 1);

        // add new polygons to list
        for (i = 0; i < newPolygons.length; i++) {
          polygons.push(newPolygons[i]);
        }
      } else {
        poly.simple = true; // eslint-disable-line no-param-reassign
      }
    }

    function clockWise(poly) { // eslint-disable-line no-param-reassign
      var p, q, n = poly.vertices.length,
        pv, qv, sum = 0;
      for (p = n - 1, q = 0; q < n; p = q, q++) {
        pv = poly.vertices[p];
        qv = poly.vertices[q];
        // sum += (next.x - v.x) * (next.y + v.y);
        // sum += (v.next.x + v.x) * (v.next.y - v.y);
        sum += pv.x * qv.y - qv.x * pv.y;
      }
      return sum > 0;
    }

    function triangulate(poly) { // eslint-disable-line no-param-reassign
      var v, points = poly.vertices,
        n, V = [], indices = [],
        nv, count, m, u, w,

        //todo: give these variables much better names
        a, b, c, s, t;

      function pointInTriangle(a, b, c, p) {
        var ax, ay, bx, by, cx, cy, apx, apy, bpx, bpy, cpx, cpy,
          cXap, bXcp, aXbp;

        ax = c.x - b.x;
        ay = c.y - b.y;
        bx = a.x - c.x;
        by = a.y - c.y;
        cx = b.x - a.x;
        cy = b.y - a.y;
        apx = p.x - a.x;
        apy = p.y - a.y;
        bpx = p.x - b.x;
        bpy = p.y - b.y;
        cpx = p.x - c.x;
        cpy = p.y - c.y;

        aXbp = ax * bpy - ay * bpx;
        cXap = cx * apy - cy * apx;
        bXcp = bx * cpy - by * cpx;

        return aXbp >= 0 && bXcp >= 0 && cXap >= 0;
      }

      function snip(u, v, w, n, V) {
        var p, a, b, c, point;
        a = points[V[u]];
        b = points[V[v]];
        c = points[V[w]];
        if (0 > (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) {
          return false;
        }
        for (p = 0; p < n; p++) {
          if (!(p === u || p === v || p === w)) {
            point = points[V[p]];
            if (pointInTriangle(a, b, c, point)) {
              return false;
            }
          }
        }
        return true;
      }

      //copy points
      //for (v = 0; v < poly.vertices.length; v++) {
      //	points.push(poly.vertices[v]);
      //}
      n = points.length;

      if (poly.clockWise) {
        for (v = 0; v < n; v++) {
          V[v] = v;
        }
      } else {
        for (v = 0; v < n; v++) {
          V[v] = (n - 1) - v;
        }
      }

      nv = n;
      count = 2 * nv;
      m = 0;
      v = nv - 1;
      while (nv > 2) {
        if ((count--) <= 0) {
          return indices;
        }

        u = v;
        if (nv <= u) {
          u = 0;
        }

        v = u + 1;
        if (nv <= v) {
          v = 0;
        }

        w = v + 1;
        if (nv < w) {
          w = 0;
        }

        if (snip(u, v, w, nv, V)) {
          a = V[u];
          b = V[v];
          c = V[w];
          if (poly.clockWise) {
            indices.push(points[a]);
            indices.push(points[b]);
            indices.push(points[c]);
          } else {
            indices.push(points[c]);
            indices.push(points[b]);
            indices.push(points[a]);
          }
          m++;
          for (s = v, t = v + 1; t < nv; s++, t++) {
            V[s] = V[t];
          }
          nv--;
          count = 2 * nv;
        }
      }

      polygon.indices = indices;
    }

    polys = makePolygonsArray(poly);

    for (i = 0; i < polys.length; i++) {
      poly = polys[i]; // eslint-disable-line no-param-reassign
      prev = null;
      polygon = {
        vertices: [],
        edges: [],
      };

      for (j = 0; j < poly.length; j++) {
        v = poly[j];
        if (typeof v === 'object' && !isNaN(v.x) && !isNaN(v.y)) {
          vert = {
            x: v.x,
            y: v.y,
            id: vertices.length,
          };
        } else if (v.length >= 2 && !isNaN(v[0]) && !isNaN(v[1])) {
          vert = {
            x: v[0],
            y: v[1],
            id: vertices.length,
          };
        }
        if (vert) {
          if (prev) {
            prev.next = vert;
            vert.prev = prev;
            vert.next = polygon.vertices[0];
            polygon.vertices[0].prev = vert;
          } else {
            polygon.head = vert;
            vert.next = vert;
            vert.prev = vert;
          }
          vertices.push(vert);
          polygon.vertices.push(vert);
          prev = vert;
        }
      }

      if (polygon.vertices.length > 2) {
        if (polygon.vertices.length === 3) {
          polygon.simple = true;
        }

        polygons.push(polygon);

        //save edges
        for (j = 0; j < polygon.vertices.length; j++) {
          vert = polygon.vertices[j];
          polygon.edges.push([
            vert, vert.next
          ]);
        }
      }
    }

    for (i = polygons.length - 1; i >= 0; i--) {
      polygon = polygons[i];
      makeSimple(polygon);
    }

    for (i = 0; i < polygons.length; i++) {
      polygon = polygons[i];
      polygon.clockWise = clockWise(polygon);
      triangulate(polygon);
    }

    //build shape
    shape.vertices = [];
    shape.coords = [];
    for (i = 0; i < vertices.length; i++) {
      v = vertices[i];
      shape.vertices.push(v.x * 2 - 1);
      shape.vertices.push(v.y * -2 + 1);
      shape.vertices.push(-1);

      shape.coords.push(v.x);
      shape.coords.push(v.y * -1 + 1);
    }
    shape.vertices = new Float32Array(shape.vertices);
    shape.coords = new Float32Array(shape.coords);

    shape.indices = [];
    for (i = 0; i < polygons.length; i++) {
      polygon = polygons[i];
      for (j = 0; j < polygon.indices.length; j++) {
        v = polygon.indices[j];
        shape.indices.push(v.id);
        //shape.indices.push(v[1].id);
        //shape.indices.push(v[2].id);
      }
    }
    shape.indices = new Uint16Array(shape.indices);

    this.shape = shape;
    if (this.gl) {
      makeGlModel(shape, this.gl);
    }
  }

  destroy() {
    var i, key, item, hook = this.hook;

    //let effect destroy itself
    if (this.effect.destroy && typeof this.effect.destroy === 'function') {
      this.effect.destroy.call(this);
    }
    delete this.effect;

    //shader
    if (this.seriously.commonShaders[hook]) {
      this.seriously.commonShaders[hook].count--;
      if (!this.seriously.commonShaders[hook].count) {
        delete this.seriously.commonShaders[hook];
      }
    }
    if (this.shader && this.shader.destroy && this.shader !== this.seriously.baseShader
      && !this.seriously.commonShaders[hook]) {
      this.shader.destroy();
    }
    delete this.shader;

    //stop watching any input elements
    for (key in this.inputElements) {
      if (this.inputElements.hasOwnProperty(key)) {
        item = this.inputElements[key];
        item.element.removeEventListener('change', item.listener, true);
        item.element.removeEventListener('input', item.listener, true);
      }
    }

    //sources
    for (key in this.sources) {
      if (this.sources.hasOwnProperty(key)) {
        item = this.sources[key];
        if (item && item.removeTarget) {
          item.removeTarget(this);
        }
        delete this.sources[key];
      }
    }

    // targets
    while (this.targets.length) {
      item = this.targets.pop();
      if (item && item.removeSource) {
        item.removeSource(this);
      }
    }

    for (key in this) {
      if (this.hasOwnProperty(key) && key !== 'id') {
        delete this[key];
      }
    }

    // remove any aliases
    for (key in this.seriously.aliases) {
      if (this.seriously.aliases.hasOwnProperty(key)) {
        item = this.seriously.aliases[key];
        if (item.node === this) {
          this.seriously.seriously.removeAlias(key);
        }
      }
    }

    // remove self from master list of effects
    i = this.seriously.effects.indexOf(this);
    if (i >= 0) {
      this.seriously.effects.splice(i, 1);
    }

    i = this.seriously.Seriously.registry.allEffectsByHook[hook].indexOf(this);
    if (i >= 0) {
      this.seriously.Seriously.registry.allEffectsByHook[hook].splice(i, 1);
    }

    Node.prototype.destroy.call(this);
  }
}
