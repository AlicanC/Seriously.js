import Transform from '../aaTransform.js';

module.exports = new Transform('flip', function () {
	    var me = this,
		    horizontal = true;

	    function recompute() {
		    var matrix = me.matrix;

		//calculate transformation matrix
		//mat4.identity(matrix);

		//scale
		    if (horizontal) {
			    matrix[0] = -1;
			    matrix[5] = 1;
		} else {
			    matrix[0] = 1;
			    matrix[5] = -1;
		}
	}

	    mat4.identity(me.matrix);
	    recompute();

	    me.transformDirty = true;

	    me.transformed = true;

	    return {
		    inputs: {
			    direction: {
				    get: function () {
					    return horizontal ? 'horizontal' : 'vertical';
				},
				    set: function (d) {
					    var horiz;
					    if (d === 'vertical') {
						    horiz = false;
					} else {
						    horiz = true;
					}

					    if (horiz === horizontal) {
						    return false;
					}

					    horizontal = horiz;
					    recompute();
					    return true;
				},
				    type: 'string'
			}
		}
	};
}, {
	    title: 'Flip',
	    description: 'Flip Horizontal/Vertical'
});
