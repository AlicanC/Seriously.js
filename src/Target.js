const Target = module.exports = function Target(targetNode) {
  var me = targetNode;

  //priveleged accessor methods
  Object.defineProperties(this, {
    source: {
      enumerable: true,
      configurable: true,
      get: function () {
        if (me.source) {
          return me.source.pub;
        }
      },
      set: function (value) {
        me.setSource(value);
      }
    },
    original: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.target;
      }
    },
    width: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.width;
      },
      set: function (value) {
        if (!isNaN(value) && value >0 && me.width !== value) {
          me.width = value;
          me.resize();
          me.setTransformDirty();
        }
      }
    },
    height: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.height;
      },
      set: function (value) {
        if (!isNaN(value) && value >0 && me.height !== value) {
          me.height = value;
          me.resize();
          me.setTransformDirty();
        }
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

  this.go = function (options) {
    me.go(options);
  };

  this.stop = function () {
    me.stop();
  };

  this.getTexture = function () {
    return me.frameBuffer.texture;
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

  this.inputs = function (name) {
    return {
      source: {
        type: 'image'
      }
    };
  };

  this.isDestroyed = function () {
    return me.isDestroyed;
  };

  this.isReady = function () {
    return me.ready;
  };
};
