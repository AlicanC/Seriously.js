const SourceNode = module.exports = function SourceNode(sourceNode) {
  var me = sourceNode;

  //priveleged accessor methods
  Object.defineProperties(this, {
    original: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.source;
      }
    },
    id: {
      enumerable: true,
      configurable: true,
      get: function () {
        return me.id;
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
    }
  });

  this.render = function () {
    me.render();
  };

  this.update = function () {
    me.setDirty();
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
