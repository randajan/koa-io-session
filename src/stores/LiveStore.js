
export class LiveStore extends Map  {

    get(sid) {
        return super.get(sid);
    }

    set(sid, state) {
        super.set(sid, state);
        return true;
    }

    destroy(sid) {
        return super.delete(sid);
    }

    list() {
        return this.keys();
    }

    
}