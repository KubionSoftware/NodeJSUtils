class Obj {
    static clone (obj, hash = new WeakMap()) {
        // Do not try to clone primitives or functions
        if (Object(obj) !== obj || obj instanceof Function) return obj;

        if (hash.has(obj)) return hash.get(obj); // Cyclic reference

        try { // Try to run constructor (without arguments, as we don't know them)
            var result = new obj.constructor();
        } catch(e) { // Constructor failed, create object without running the constructor
            result = Object.create(Object.getPrototypeOf(obj));
        }

        // Optional: support for some standard constructors (extend as desired)
        if (obj instanceof Map) Array.from(obj, ([key, val]) => result.set(Obj.clone(key, hash), Obj.clone(val, hash)));
        else if (obj instanceof Set) Array.from(obj, (key) => result.add(Obj.clone(key, hash)));

        // Register in hash    
        hash.set(obj, result);

        // Clone and assign enumerable own properties recursively
        return Object.assign(result, ...Object.keys(obj).map(key => ({ [key]: Obj.clone(obj[key], hash) })));
    }

    static deepSet (obj, path, newValue, oldValue, set, remove) {
        if (!set) set = (obj, key, value) => obj[key] = value;
        if (!remove) remove = (obj, key) => delete obj[key];

        if (!Obj.defined(obj)) {
            if (isNaN(path[0])) {
                obj = {};
            } else {
                obj = [];
            }
        }
    
        if (path.length > 1) {
            const key = path[0];
    
            Obj.deepSet(obj[key], path.slice(1), newValue, oldValue, set, remove);
        } else {
            if (!Obj.defined(newValue)) {
                remove(obj, path[0]);
            } else {
                set(obj, path[0], newValue);
            }
        }
    }

    static filterUndefined (obj) {
        if (Array.isArray(obj)) {
            obj = obj.filter(item => typeof item != "undefined" && item != null);
    
            for (let i = 0; i < obj.length; i++) {
                obj[i] = Obj.filterUndefined(obj[i]);
            }
        } else if (typeof obj == "object") {
            const undefinedKeys = [];
    
            for (let key in obj) {
                if (typeof obj[key] == "undefined") {
                    undefinedKeys.push(key);
                } else {
                    obj[key] = Obj.filterUndefined(obj[key]);
                }
            }
    
            undefinedKeys.forEach(key => delete obj[key]);
        }
        return obj;
    }

    static findChanges (newObj, oldObj, path, changes) {
        if (!path) path = [];
        if (!changes) changes = [];

        for (const key in newObj) {
            const newValue = newObj[key];
            const oldValue = oldObj[key];
    
            const newType = typeof newValue;
            const oldType = typeof oldValue;
    
            if (newType != oldType) {
                changes.push({
                    key: [...path, key].join("."),
                    oldValue: oldValue,
                    newValue: newValue
                });
            } else if (Array.isArray(newValue) != Array.isArray(oldValue)) {
                changes.push({
                    key: [...path, key].join("."),
                    oldValue: oldValue,
                    newValue: newValue
                });					
            } else if (newType == "object") {
                Obj.findChanges(newValue, oldValue, [...path, key], changes);
            } else if (newValue != oldValue) {
                changes.push({
                    key: [...path, key].join("."),
                    oldValue: oldValue,
                    newValue: newValue
                });
            }
        }
    
        for (const key in oldObj) {
            if (!(key in newObj)) {
                changes.push({
                    key: [...path, key].join("."),
                    oldValue: oldObj[key],
                    newValue: undefined
                });
            }
        }
    
        return changes;
    }

    static deepGet (obj, path) {
        if (path.length == 0 || !(path[0] in obj)) return undefined;
        if (path.length == 1) return obj[path[0]];
        return Obj.deepGet(obj[path[0]], path.slice(1));
    }

    static removeIndex (array, index, newElement) {
        var newArray = [];
        for (var i = 0; i < array.length; i++) {
            if (i != index) {
                newArray.push(array[i]);
            } else if (Obj.defined(newElement)) {
                newArray.push(newElement);
            }
        }
        return newArray;
    }

    static addIndex (array, index, data) {
        if (array.length == 0) return [data];
        if (index >= array.length) return [...array, data];

        var newArray = [];
        for (var i = 0; i < array.length; i++) {
            if (i == index) newArray.push(data);
            newArray.push(array[i]);
        }
        return newArray;
    }
    
    static defined (value) {
        return typeof value != "undefined";
    }
}

module.exports = Obj;