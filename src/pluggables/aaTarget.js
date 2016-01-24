import Plugable from './Plugable.js';

export default class Target extends Plugable {
  plug(Seriously) {
    super.plug(Seriously, 'target');
  }
}
