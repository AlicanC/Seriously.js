export default class Plugable {
  constructor(hook, definition, meta) {
    this.hook = hook;

    if (meta === undefined && typeof definition === 'object') {
      this.meta = definition;
    } else {
      this.definition = definition;
      this.meta = meta;
    }
  }

  plug(Seriously, socket) {
    console.log(`Plugging ${this.hook} to ${socket}...`);
    if (this.definition) {
  		        Seriously[socket](this.hook, this.definition, this.meta);
  	    } else {
  		        Seriously[socket](this.hook, this.meta);
  	    }
  }
}
