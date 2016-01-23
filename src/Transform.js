const util = require('./util.js');

const Transform = module.exports = function Transform(transformNode) {
  var me = transformNode,
    self = this,
    key;

  function setInput(inputName, def, input) {
    var inputKey, lookup, value;

    lookup = me.inputElements[inputName];

    //todo: there is some duplicate code with Effect here. Consolidate.
    if (typeof input === 'string' && isNaN(input)) {
      if (def.type === 'enum') {
        if (!def.options.hasOwnProperty(input)) {
          input = getElement(input, ['select']);
        }
      } else if (def.type === 'number' || def.type === 'boolean') {
        input = getElement(input, ['input', 'select']);
      } else if (def.type === 'image') {
        input = getElement(input, ['canvas', 'img', 'video']);
      }
    }

    if (util.isInstance(input, 'HTMLInputElement') || util.isInstance(input, 'HTMLSelectElement')) {
      value = input.value;

      if (lookup && lookup.element !== input) {
        lookup.element.removeEventListener('change', lookup.listener, true);
        lookup.element.removeEventListener('input', lookup.listener, true);
        delete me.inputElements[inputName];
        lookup = null;
      }

      if (!lookup) {
        lookup = {
          element: input,
          listener: (function (element) {
            return function () {
              var oldValue, newValue;

              if (input.type === 'checkbox') {
                //special case for check box
                oldValue = input.checked;
              } else {
                oldValue = element.value;
              }
              newValue = me.setInput(inputName, oldValue);

              //special case for color type
              if (input.type === 'color') {
                newValue = colorArrayToHex(newValue);
              }

              //if input validator changes our value, update HTML Element
              //todo: make this optional...somehow
              if (newValue !== oldValue) {
                element.value = newValue;
              }
            };
          }(input))
        };

        me.inputElements[inputName] = lookup;
        if (input.type === 'range') {
          input.addEventListener('input', lookup.listener, true);
          input.addEventListener('change', lookup.listener, true);
        } else {
          input.addEventListener('change', lookup.listener, true);
        }
      }

      if (lookup && input.type === 'checkbox') {
        value = input.checked;
      }
    } else {
      if (lookup) {
        lookup.element.removeEventListener('change', lookup.listener, true);
        lookup.element.removeEventListener('input', lookup.listener, true);
        delete me.inputElements[inputName];
      }
      value = input;
    }

    me.setInput(inputName, value);
  }

  function setProperty(name, def) {
    // todo: validate value passed to 'set'
    Object.defineProperty(self, name, {
      configurable: true,
      enumerable: true,
      get: function () {
        return def.get.call(me);
      },
      set: function (val) {
        setInput(name, def, val);
      }
    });
  }

  function makeMethod(method) {
    return function () {
      if (method.apply(me, arguments)) {
        me.setTransformDirty();
      }
    };
  }

  //priveleged accessor methods
  Object.defineProperties(this, {
    transform: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.hook;
      }
    },
    title: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.plugin.title || me.hook;
      }
    },
    width: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.width;
      }
    },
    height: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.height;
      }
    },
    id: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.id;
      }
    },
    source: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.source && me.source.pub;
      },
      set: function (source) {
        me.setSource(source);
      }
    }
  });

  // attach methods
  for (key in me.methods) {
    if (me.methods.hasOwnProperty(key)) {
      this[key] = makeMethod(me.methods[key]);
    }
  }

  for (key in me.inputs) {
    if (me.inputs.hasOwnProperty(key)) {
      setProperty(key, me.inputs[key]);
    }
  }

  this.update = function () {
    me.setDirty();
  };

  this.inputs = function (name) {
    var result,
      input,
      inputs,
      i,
      key;

    inputs = me.plugin.inputs;

    /*
    Only reports setter/getter inputs, not methods
    */

    if (name) {
      input = inputs[name];
      if (!input || input.method) {
        return null;
      }

      result = {
        type: input.type,
        defaultValue: input.defaultValue,
        title: input.title || name
      };

      if (input.type === 'number') {
        result.min = input.min;
        result.max = input.max;
        result.step = input.step;
        result.mod = input.mod;
      } else if (input.type === 'enum') {
        //make a copy
        result.options = Object.assign({}, input.options);
      } else if (input.type === 'vector') {
        result.dimensions = input.dimensions;
      }

      if (input.description) {
        result.description = input.description;
      }

      return result;
    }

    result = {};
    for (key in inputs) {
      if (inputs.hasOwnProperty(key) && !inputs[key].method) {
        result[key] = this.inputs(key);
      }
    }
    return result;
  };

  this.alias = function (inputName, aliasName) {
    me.alias(inputName, aliasName);
    return this;
  };

  this.on = function (eventName, callback) {
    me.on(eventName, callback);
  };

  this.off = function (eventName, callback) {
    me.off(eventName, callback);
  };

  this.destroy = function () {
    var i,
      descriptor;

    me.destroy();

    for (i in this) {
      if (this.hasOwnProperty(i) && i !== 'isDestroyed' && i !== 'id') {
        //todo: probably can simplify this if the only setter/getter is id
        descriptor = Object.getOwnPropertyDescriptor(this, i);
        if (descriptor.get || descriptor.set ||
            typeof this[i] !== 'function') {
          delete this[i];
        } else {
          this[i] = nop;
        }
      }
    }
  };

  this.isDestroyed = function () {
    return me.isDestroyed;
  };

  this.isReady = function () {
    return me.ready;
  };
};
