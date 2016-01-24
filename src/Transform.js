import Pluggable from './Pluggable.js';
import { getElement, isInstance, colorArrayToHex } from './utilities.js';

function setInput(node, inputName, def, input) {
  var inputKey, lookup, value; // eslint-disable-line

  lookup = node.inputElements[inputName];

  // TODO: there is some duplicate code with Effect here. Consolidate.
  if (typeof input === 'string' && isNaN(input)) {
    if (def.type === 'enum') {
      if (!def.options.hasOwnProperty(input)) {
        input = getElement(input, ['select']); // eslint-disable-line no-param-reassign
      }
    } else if (def.type === 'number' || def.type === 'boolean') {
      input = getElement(input, ['input', 'select']); // eslint-disable-line no-param-reassign
    } else if (def.type === 'image') {
      input = getElement(input, ['canvas', 'img', 'video']); // eslint-disable-line no-param-reassign, max-len
    }
  }

  if (isInstance(input, 'HTMLInputElement') || isInstance(input, 'HTMLSelectElement')) {
    value = input.value;

    if (lookup && lookup.element !== input) {
      lookup.element.removeEventListener('change', lookup.listener, true);
      lookup.element.removeEventListener('input', lookup.listener, true);
      delete node.inputElements[inputName]; // eslint-disable-line no-param-reassign
      lookup = null;
    }

    if (!lookup) {
      lookup = {
        element: input,
        listener: (function (element) { // eslint-disable-line
          return function () { // eslint-disable-line
            var oldValue, newValue; // eslint-disable-line

            if (input.type === 'checkbox') {
              // special case for check box
              oldValue = input.checked;
            } else {
              oldValue = element.value;
            }
            newValue = node.setInput(inputName, oldValue);

            // special case for color type
            if (input.type === 'color') {
              newValue = colorArrayToHex(newValue);
            }

            // if input validator changes our value, update HTML Element
            // TODO: make this optional...somehow
            if (newValue !== oldValue) {
              element.value = newValue;  // eslint-disable-line no-param-reassign
            }
          };
        }(input)),
      };

      node.inputElements[inputName] = lookup;  // eslint-disable-line no-param-reassign
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
      delete node.inputElements[inputName]; // eslint-disable-line no-param-reassign
    }
    value = input;
  }

  node.setInput(inputName, value);
}

function setProperty(node, name, def) {
  // todo: validate value passed to 'set'
  Object.defineProperty(self, name, {
    configurable: true,
    enumerable: true,
    get: () => def.get.call(node),
    set: (val) => {
      setInput(node, name, def, val);
    },
  });
}

function makeMethod(node, method) {
  return (...args) => {
    if (method.apply(node, args)) {
      node.setTransformDirty();
    }
  };
}

export default class Transform extends Pluggable {
  get transform() {
    return this.node.hook;
  }

  get title() {
    return this.node.plugin.title || this.node.hook;
  }

  get source() {
    return this.node.source && this.node.source.pub;
  }
  set source(source) {
    this.node.setSource(source);
  }

  constructor(transformNode) {
    super(transformNode);

    // attach methods
    for (const key in this.node.methods) {
      if (this.node.methods.hasOwnProperty(key)) {
        this[key] = makeMethod(this.node.methods[key]);
      }
    }

    for (const key in this.node.inputs) {
      if (this.node.inputs.hasOwnProperty(key)) {
        setProperty(key, this.node.inputs[key]);
      }
    }
  }

  update() {
    this.node.setDirty();
  }

  inputs(name) {
    const inputs = this.node.plugin.inputs;

    /*
    Only reports setter/getter inputs, not methods
    */

    if (name) {
      const input = inputs[name];
      if (!input || input.method) {
        return null;
      }

      const result = {
        type: input.type,
        defaultValue: input.defaultValue,
        title: input.title || name,
      };

      if (input.type === 'number') {
        result.min = input.min;
        result.max = input.max;
        result.step = input.step;
        result.mod = input.mod;
      } else if (input.type === 'enum') {
        // make a copy
        result.options = Object.assign({}, input.options);
      } else if (input.type === 'vector') {
        result.dimensions = input.dimensions;
      }

      if (input.description) {
        result.description = input.description;
      }

      return result;
    }

    const result = {};
    for (const key in inputs) {
      if (inputs.hasOwnProperty(key) && !inputs[key].method) {
        result[key] = this.inputs(key);
      }
    }
    return result;
  }

  alias(...args) {
    this.node.alias(...args);
    return this;
  }
}
