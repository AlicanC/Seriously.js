const util = require('./util.js');
const isInstance = util.isInstance;

const Effect = module.exports = function Effect(effectNode) {
  var name, me = effectNode;

  function setInput(inputName, input) {
    var lookup, value, effectInput, i;

    effectInput = me.effect.inputs[inputName];

    lookup = me.inputElements[inputName];

    if (typeof input === 'string' && isNaN(input)) {
      if (effectInput.type === 'enum') {
        if (!effectInput.options.hasOwnProperty(input)) {
          input = getElement(input, ['select']);
        }
      } else if (effectInput.type === 'number' || effectInput.type === 'boolean') {
        input = getElement(input, ['input', 'select']);
      } else if (effectInput.type === 'image') {
        input = getElement(input, ['canvas', 'img', 'video']);
      }
      //todo: color? date/time?
    }

    if (isInstance(input, 'HTMLInputElement') || isInstance(input, 'HTMLSelectElement')) {
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
          listener: (function (name, element) {
            return function () {
              var oldValue, newValue;

              if (input.type === 'checkbox') {
                //special case for check box
                oldValue = input.checked;
              } else {
                oldValue = element.value;
              }
              newValue = me.setInput(name, oldValue);

              //special case for color type
              if (effectInput.type === 'color') {
                newValue = colorArrayToHex(newValue).substr(0, 7);
              }

              //if input validator changes our value, update HTML Element
              //todo: make this optional...somehow
              if (newValue !== oldValue) {
                element.value = newValue;
              }
            };
          }(inputName, input))
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
    return me.inputs[inputName];
  }

  function makeImageSetter(inputName) {
    return function (value) {
      var val = setInput(inputName, value);
      return val && val.pub;
    };
  }

  function makeImageGetter(inputName) {
    return function () {
      var val = me.inputs[inputName];
      return val && val.pub;
    };
  }

  function makeSetter(inputName) {
    return function (value) {
      return setInput(inputName, value);
    };
  }

  function makeGetter(inputName) {
    return function () {
      return me.inputs[inputName];
    };
  }

  //priveleged publicly accessible methods/setters/getters
  //todo: provide alternate set/get methods
  for (name in me.effect.inputs) {
    if (me.effect.inputs.hasOwnProperty(name)) {
      if (this[name] === undefined) {
        if (me.effect.inputs[name].type === 'image') {
          Object.defineProperty(this, name, {
            configurable: true,
            enumerable: true,
            get: makeImageGetter(name),
            set: makeImageSetter(name)
          });
        } else {
          Object.defineProperty(this, name, {
            configurable: true,
            enumerable: true,
            get: makeGetter(name),
            set: makeSetter(name)
          });
        }
      } else {
        //todo: this is temporary. get rid of it.
        throw new Error('Cannot overwrite Seriously.' + name);
      }
    }
  }

  Object.defineProperties(this, {
    effect: {
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
        return me.effect.title || me.hook;
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
    }
  });

  this.render = function () {
    me.render();
    return this;
  };

  this.readPixels = function (x, y, width, height, dest) {
    return me.readPixels(x, y, width, height, dest);
  };

  this.on = function (eventName, callback) {
    me.on(eventName, callback);
  };

  this.off = function (eventName, callback) {
    me.off(eventName, callback);
  };

  this.inputs = function (name) {
    var result,
      input,
      inputs,
      i,
      key;

    inputs = me.effect.inputs;

    if (name) {
      input = inputs[name];
      if (!input) {
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
      if (inputs.hasOwnProperty(key)) {
        result[key] = this.inputs(key);
      }
    }
    return result;
  };

  this.alias = function (inputName, aliasName) {
    me.alias(inputName, aliasName);
    return this;
  };

  this.matte = function (polygons) {
    me.matte(polygons);
  };

  this.destroy = function () {
    var i,
      descriptor;

    me.destroy();

    for (i in this) {
      if (this.hasOwnProperty(i) && i !== 'isDestroyed' && i !== 'id') {
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
