import Plugable from './Plugable.js';

export default class Source extends Plugable {
  plug(Seriously) {
    super.plug(Seriously, 'source');
  }
}
