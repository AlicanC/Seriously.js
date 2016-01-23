import Plugable from './Plugable.js';

export default class Plugin extends Plugable {
  plug(Seriously) {
    super.plug(Seriously, 'plugin');
  }
};
