import {
  colorRegex,
  hexColorRegex,
  hslToRgb,
  colorNames,
  isArrayLike,
  colorFields,
  vectorFields,
} from './utilities.js';

let colorCtx;
const inputValidators = {
  color(value, input, defaultValue, oldValue) {
    let a = oldValue || [];

    if (typeof value === 'string') {
      // TODO: support percentages, decimals
      let match = colorRegex.exec(value);
      if (match && match.length) {
        if (match.length < 3) {
          a[0] = a[1] = a[2] = a[3] = 0;
          return a;
        }

        a[3] = 1;
        for (let i = 0; i < 3; i++) {
          a[i] = parseFloat(match[i + 2]) / 255;
        }
        if (!isNaN(match[6])) {
          a[3] = parseFloat(match[6]);
        }
        if (match[1].toLowerCase() === 'hsl') {
          return hslToRgb(a[0], a[1], a[2], a[3], a);
        }

        return a;
      }

      match = hexColorRegex.exec(value);
      if (match && match.length) {
        const s = match[1];
        if (s.length === 3) {
          a[0] = parseInt(s[0], 16) / 15;
          a[1] = parseInt(s[1], 16) / 15;
          a[2] = parseInt(s[2], 16) / 15;
          a[3] = 1;
        } else if (s.length === 4) {
          a[0] = parseInt(s[0], 16) / 15;
          a[1] = parseInt(s[1], 16) / 15;
          a[2] = parseInt(s[2], 16) / 15;
          a[3] = parseInt(s[3], 16) / 15;
        } else if (s.length === 6) {
          a[0] = parseInt(s.substr(0, 2), 16) / 255;
          a[1] = parseInt(s.substr(2, 2), 16) / 255;
          a[2] = parseInt(s.substr(4, 2), 16) / 255;
          a[3] = 1;
        } else if (s.length === 8) {
          a[0] = parseInt(s.substr(0, 2), 16) / 255;
          a[1] = parseInt(s.substr(2, 2), 16) / 255;
          a[2] = parseInt(s.substr(4, 2), 16) / 255;
          a[3] = parseInt(s.substr(6, 2), 16) / 255;
        } else {
          a[0] = a[1] = a[2] = a[3] = 0;
        }
        return a;
      }

      match = colorNames[value.toLowerCase()];
      if (match) {
        for (let i = 0; i < 4; i++) {
          a[i] = match[i];
        }
        return a;
      }

      if (!colorCtx) {
        colorCtx = document.createElement('canvas').getContext('2d');
      }
      colorCtx.fillStyle = value;
      const s = colorCtx.fillStyle;
      if (s && s !== '#000000') {
        return inputValidators.color(s, input, defaultValue, oldValue);
      }

      a[0] = a[1] = a[2] = a[3] = 0;
      return a;
    }

    if (isArrayLike(value)) {
      a = value;
      if (a.length < 3) {
        a[0] = a[1] = a[2] = a[3] = 0;
        return a;
      }
      for (let i = 0; i < 3; i++) {
        if (isNaN(a[i])) {
          a[0] = a[1] = a[2] = a[3] = 0;
          return a;
        }
      }
      if (a.length < 4) {
        a.push(1);
      }
      return a;
    }

    if (typeof value === 'number') {
      a[0] = a[1] = a[2] = value;
      a[3] = 1;
      return a;
    }

    if (typeof value === 'object') {
      for (let i = 0; i < 4; i++) {
        const s = colorFields[i];
        if (value[s] === null || isNaN(value[s])) {
          a[i] = i === 3 ? 1 : 0;
        } else {
          a[i] = value[s];
        }
      }
      return a;
    }

    a[0] = a[1] = a[2] = a[3] = 0;
    return a;
  },
  number(value, input, defaultValue) {
    value = parseFloat(value); // eslint-disable-line no-param-reassign

    if (isNaN(value)) {
      return defaultValue || 0;
    }

    if (input.mod) {
      value = value - input.mod * Math.floor(value / input.mod); // eslint-disable-line no-param-reassign, max-len
    }

    if (value < input.min) {
      return input.min;
    }

    if (value > input.max) {
      return input.max;
    }

    if (input.step) {
      return Math.round(value / input.step) * input.step;
    }

    return value;
  },
  enum(value, input, defaultValue) {
    const options = input.options || [];

    if (typeof value === 'string') {
      value = value.toLowerCase(); // eslint-disable-line no-param-reassign
    } else if (typeof value === 'number') {
      value = value.toString(); // eslint-disable-line no-param-reassign
    } else if (!value) {
      value = ''; // eslint-disable-line no-param-reassign
    }

    if (options.hasOwnProperty(value)) {
      return value;
    }

    return defaultValue || '';
  },
  vector(value, input, defaultValue, oldValue) {
    const n = input.dimensions || 4;

    const a = oldValue || [];
    if (isArrayLike(value)) {
      for (let i = 0; i < n; i++) {
        a[i] = value[i] || 0;
      }
      return a;
    }

    if (typeof value === 'object') {
      for (let i = 0; i < n; i++) {
        let s = vectorFields[i];
        if (value[s] === undefined) {
          s = colorFields[i];
        }
        a[i] = value[s] || 0;
      }
      return a;
    }

    value = parseFloat(value) || 0; // eslint-disable-line no-param-reassign
    for (let i = 0; i < n; i++) {
      a[i] = value;
    }

    return a;
  },
  boolean(value) {
    if (!value) {
      return false;
    }

    if (value && value.toLowerCase && value.toLowerCase() === 'false') {
      return false;
    }

    return true;
  },
  string(value) {
    if (typeof value === 'string') {
      return value;
    }

    if (value !== 0 && !value) {
      return '';
    }

    if (value.toString) {
      return value.toString();
    }

    return String(value);
  },
  // TODO: date/time
};

export default inputValidators;
