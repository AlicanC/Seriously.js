import Plugable from './Plugable.js';

export default class Transform extends Plugable {
  plug(Seriously) {
    super.plug(Seriously, 'transform');
  }
};
