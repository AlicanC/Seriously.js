import Pluggable from './Pluggable.js';

import { isInstance, getElement, colorArrayToHex } from './utilities.js';

function setInput(node, inputName, input) {
  var lookup, value, effectInput, i; // eslint-disable-line

  effectInput = node.effect.inputs[inputName];

  lookup = node.inputElements[inputName];

  if (typeof input === 'string' && isNaN(input)) {
    if (effectInput.type === 'enum') {
      if (!effectInput.options.hasOwnProperty(input)) {
        input = getElement(input, ['select']); // eslint-disable-line no-param-reassign
      }
    } else if (effectInput.type === 'number' || effectInput.type === 'boolean') {
      input = getElement(input, ['input', 'select']); // eslint-disable-line no-param-reassign
    } else if (effectInput.type === 'image') {
      input = getElement(input, ['canvas', 'img', 'video']); // eslint-disable-line no-param-reassign, max-len
    }
    // TODO: color? date/time?
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
        listener: (function (name, element) { // eslint-disable-line
          return function () { // eslint-disable-line
            var oldValue, newValue; // eslint-disable-line

            if (input.type === 'checkbox') {
              // special case for check box
              oldValue = input.checked;
            } else {
              oldValue = element.value;
            }
            newValue = node.setInput(name, oldValue);

            // special case for color type
            if (effectInput.type === 'color') {
              newValue = colorArrayToHex(newValue).substr(0, 7);
            }

            // if input validator changes our value, update HTML Element
            // TODO: make this optional...somehow
            if (newValue !== oldValue) {
              element.value = newValue; // eslint-disable-line no-param-reassign
            }
          };
        }(inputName, input)),
      };

      node.inputElements[inputName] = lookup; // eslint-disable-line no-param-reassign
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
  return node.inputs[inputName];
}

function makeImageSetter(node, inputName) {
  return (value) => {
    const val = setInput(node, inputName, value);
    return val && val.pub;
  };
}

function makeImageGetter(node, inputName) {
  return () => {
    const val = node.inputs[inputName];
    return val && val.pub;
  };
}

function makeSetter(node, inputName) {
  return (value) => setInput(node, inputName, value);
}

function makeGetter(node, inputName) {
  return () => node.inputs[inputName];
}

export default class Effect extends Pluggable {
  get effect() {
    return this.node.hook;
  }

  get title() {
    return this.node.effect.title || this.node.hook;
  }

  constructor(effectNode) {
    super(effectNode);

    // TODO: provide alternate set/get methods
    for (const name in this.node.effect.inputs) {
      if (this.node.effect.inputs.hasOwnProperty(name)) {
        if (this[name] === undefined) {
          if (this.node.effect.inputs[name].type === 'image') {
            Object.defineProperty(this, name, {
              configurable: true,
              enumerable: true,
              get: makeImageGetter(this.node, name),
              set: makeImageSetter(this.node, name),
            });
          } else {
            Object.defineProperty(this, name, {
              configurable: true,
              enumerable: true,
              get: makeGetter(this.node, name),
              set: makeSetter(this.node, name),
            });
          }
        } else {
          // TODO: this is temporary. get rid of it.
          throw new Error(`Cannot overwrite Seriously.${name}`);
        }
      }
    }
  }

  render(...args) {
    this.node.render(...args);
    return this;
  }

  readPixels(...args) {
    return this.node.readPixels(...args);
  }

  inputs(name) {
    const inputs = this.node.effect.inputs;

    if (name) {
      const input = inputs[name];
      if (!input) {
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
      if (inputs.hasOwnProperty(key)) {
        result[key] = this.inputs(key);
      }
    }
    return result;
  }

  alias(...args) {
    this.node.alias(...args);
    return this;
  }

  matte(...args) {
    this.node.matte(...args);
  }
}
