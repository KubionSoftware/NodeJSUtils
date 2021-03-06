const HTTP = require("../netjs/http.js");
const Log = require("../netjs/log.js");
const Random = require("./random.js");
const {Obj} = require("kubion-netjs-utils");

class Source {

	constructor (data) {
		this.data = data;
	}

	// abstract method
	async load (query, state) {
		throw new Error("Class doesn't implement method Source.load");
	}

	// abstract method
	async save (query, data, state) {
		throw new Error("Class doesn't implement method Source.save");
	}
}

class HttpSource extends Source {

	constructor (data) {
		super(data);
	}

	async load (query, state) {
		const result = await HTTP.executeUrl(this.data.host + query, {
			method: "GET",
			extendedOutput: true,
			cookies: state.cookies
		});

		state.headers = result.headers;
		state.cookies = Object.assign(state.cookies || {}, result.cookies);
		
		try {
			return JSON.parse(result.content);
		} catch {
			return result.content;
		}
	}

	async save (query, content, state) {
		if (typeof content != "string") {
			content = JSON.stringify(content);
		}

		const headers = {};
		try {
			JSON.parse(content);
			// Valid json
			headers["Content-Type"] = "application/json; charset=utf-8";
		} catch {}

		const result = await HTTP.executeUrl(this.data.host + query, {
			method: "POST",
			content: content,
			extendedOutput: true,
			headers: headers,
			cookies: state.cookies
		});

		state.headers = result.headers;
		state.cookies = Object.assign(state.cookies || {}, result.cookies);

		try {
			return JSON.parse(result.content);
		} catch {
			return result.content;
		}
	}
}

class Action {

	constructor (data, condition) {
		this.data = data;
		this.conditionText = condition;

		try {
			this.condition = new Function("state, config", "with (config) { with (state) {return " + (condition || "true") + "}}");
		} catch (e) {
			this.condition = new Function("state, config", "return true");
		}
	}

	// abstract method
	async execute (instance, requestData) {
		throw new Error("Class doesn't implement method Action.execute");
	}
}

class LogAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const data = parseData(this.data, instance.state, instance.config);

		Log.write(data.message);
		return false;
	}
}

class WaitAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const data = parseData(this.data, instance.state, instance.config);

		instance.state._eventKey = data.outputKey;
		instance.state._eventTypes = data.types;

		return data;
	}
}

class SetAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const data = parseData(this.data, instance.state, instance.config);

		try {
			JSON.stringify(data);
		} catch (e) {
			throw new Error("Trying to set circular structure");
		}

		function deepSet (keys, target, value) {
			if (keys.length == 1) {
				target[keys[0]] = value;
			} else {
				if (!(keys[0] in target)) target[keys[0]] = {};
				deepSet(keys.slice(1), target[keys[0]], value);
			}
		}

		for (const key in data) {
			deepSet(key.split("."), instance.state, data[key]);
		}

		return false;
	}
}

class ExecAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const func = new Function("state, config", "with (config) { with (state) {" + this.data.join(";") + "}}");
		func(instance.state, instance.config);
		return false;
	}
}

class LoadAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const data = parseData(this.data, instance.state, instance.config);

		const result = await instance.environment.getSource(data.source).load(data.query, instance.state);
		instance.set(data.outputKey, result);

		return false;
	}
}

class SaveAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const data = parseData(this.data, instance.state, instance.config);

		const result = await instance.environment.getSource(data.source).save(data.query, data.content, instance.state);
		instance.set(data.outputKey, result);
		return false;
	}
}

class TransitionAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const data = parseData(this.data, instance.state, instance.config);

		instance.goto(data.nodeId);
		return false;
	}
}

class FormAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const data = parseData(this.data, instance.state, instance.config);
		return data;
	}
}

class TableAction extends Action {
	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const data = parseData(this.data, instance.state, instance.config);
		const table = await instance.environment.getTable(data.name);

		if (!instance.state._loop) {
			instance.state._loop = true;
			instance.state._columnIndex = 0;
			instance.state._askedColumnCodes = [];
			instance.state._rowIndexes = table.rows.map((row, index) => index);
        }

		const filterRows = function (column, answer) {
			return instance.state._rowIndexes.filter(index => {
				const answers = table.rows[index][column.code];
				for (let i = 0; i < answers.length; i++) {
					if (answers[i] == answer) return true;
				}
				return false;
			});
		}

		// Check if the answered question was already answered before
		// If so change the answer and remove all answers given after that question
		const answeredKeys = Object.keys(requestData);
		if (answeredKeys.length == 1 && table.columns.some(c => c.code == answeredKeys[0])) {
			const answerIndex = instance.state._askedColumnCodes.findIndex(c => c == answeredKeys[0]);
			if (answerIndex != -1 && answerIndex != instance.state._askedColumnCodes.length - 1) {
				for (let i = answerIndex + 1; i < instance.state._askedColumnCodes.length; i++) {
					delete instance.state[instance.state._askedColumnCodes[i]];
				}

				instance.state._askedColumnCodes = instance.state._askedColumnCodes.slice(0, answerIndex + 1);
				instance.state._columnIndex = table.columns.findIndex(c => c.code == instance.state._askedColumnCodes[answerIndex]) + 1;

				instance.state._rowIndexes = table.rows.map((row, index) => index);

				for (let i = 0; i < instance.state._columnIndex; i++) {
					const column = table.columns[i];
					instance.state._rowIndexes = filterRows(column, instance.state[column.code]);
				}
			}
		}

		for (instance.state._columnIndex; instance.state._columnIndex < table.columns.length; instance.state._columnIndex++) {
            const column = table.columns[instance.state._columnIndex];

			if (column.code in instance.state || column.type == "condition") {
                let filteredRows = filterRows(column, instance.state[column.code]);

                // If no row with answer then rows without answers
                if (column.type == "condition" && filteredRows.length == 0) {
                    filteredRows = instance.state._rowIndexes.filter(index => {
                        table.rows[index][column.code].length == 0;
                    });
                }

                instance.state._rowIndexes = filteredRows;
			} else if (column.type == "question") {
                // Filter answers for available rows
                const possibilities = {};
                instance.state._rowIndexes.forEach(index => table.rows[index][column.code].forEach(possibility => {
                    possibilities[possibility] = true;
                }));

                const answers = column.answers.filter(answer => answer.code in possibilities).map(answer => ({
                    value: answer.code,
                    text: answer.label
                }));

				if (answers.length == 0) continue;
				
				instance.state._askedColumnCodes.push(column.code);

                return {
					decisionTree: true,
                    elements: [
                        {
                            type: "display",
                            data: {
                                text: column.description
                            }
                        },
                        {
                            type: "select",
                            data: {
                                outputKey: column.code,
                                list: answers
                            }
                        }
                    ]
                };
            } else if (column.type == "setter") {
                if (instance.state._rowIndexes.length != 1) {
                    // TODO: throw error
                } else {
                    const row = table.rows[instance.state._rowIndexes[0]];
                    instance.state[column.code] = row[column.code];
                }
            }
		}
        
		instance.state._loop = false;
		delete instance.state._columnIndex;
		delete instance.state._askedColumnCodes;
		delete instance.state._rowIndexes;
		return false;
	}
}

class FlowAction extends Action {
	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const data = parseData(this.data, instance.state, instance.config);
		const flow = await instance.environment.getFlow(data.name, instance);
		
		instance.childFlow = new Instance(flow, instance.environment, data.stateObj || data.state, data.configObj || data.config, (childInstance, returnData) => {
			if (data.outputKey) instance.state[data.outputKey] = returnData;
			delete instance.childFlow;
		}, false);

		instance.childFlow.parentFlow = instance;

		return await instance.childFlow.start({});
	}
}

class EndAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance, requestData) {
		const data = parseData(this.data || {}, instance.state, instance.config);
		instance.end(data.output);
		return false;
	}
}

class Node {

	constructor (data, environment) {
		for (const key in data) {
			if (key != "actions") this[key] = data[key];
		}

		this.actions = [];
		for (const action of data.actions) {
			if (!(action.type in environment.actionMap)) {
				Log.write("Unknown action type " + action.type + " in flow");
			} else {
				this.actions.push(new (environment.actionMap[action.type])(action.data, action.condition));
			}
		}
	}
}

const templates = {
	custom: "${value1}",
	equal: "${value1} == ${value2}",
	notEqual: "${value1} != ${value2}",
	exists: "typeof ${value1} != \"undefined\"",
	notExists: "typeof ${value1} == \"undefined\"",
	match: "new RegExp(${value2}).test(${value1} || '')",
	notMatch: "!(new RegExp(${value2}).test(${value1} || ''))"
};

class Graph {

	constructor (data, code, environment) {
		const reduceKeyValue = function (array) {
			const obj = array.reduce((a, v) => {
				if (typeof v.value != "undefined") a[v.key] = v.value;
				else if (typeof v.$value != "undefined") a["$" + v.key] = v.$value;
				return a;
			}, {});
			return obj;
        }
        
        // Convert config to object
        this.config = Array.isArray(data.config) ? reduceKeyValue(data.config) : data.config;

		for (let node of data.nodes) {
			// Convert node 'set' to object
			let setters = node.actions.filter(a => a.type == "set" && Array.isArray(a.data));
			for (let setter of setters) {
				setter.data = reduceKeyValue(setter.data);
			}

			// Convert flow state & config to object
			let flows = node.actions.filter(a => a.type == "flow");
			for (let flow of flows) {
				if (Array.isArray(flow.data.stateObj)) {
					flow.data.stateObj = reduceKeyValue(flow.data.stateObj);
				}
				if (Array.isArray(flow.data.configObj)) {
					flow.data.configObj = reduceKeyValue(flow.data.configObj);
				}
			}

			// Convert condition to string
			const actions = node.actions.filter(a => a.condition && typeof a.condition == "object");
			for (const action of actions) {
				// Used in template
				let value1 = undefined;
				if (typeof action.condition.value1 != "undefined") {
					value1 = "\"" + action.condition.value1.replace(/"/g, "\\\"") + "\"";
				} else if (typeof action.condition.$value1 != "undefined") value1 = action.condition.$value1;

				let value2 = undefined;
				if (typeof action.condition.value2 != "undefined") {
					value2 = "\"" + action.condition.value2.replace(/"/g, "\\\"") + "\"";
				} else if (typeof action.condition.$value2 != "undefined") value2 = action.condition.$value2;

				if (typeof templates[action.condition.type] != "undefined") {
					try {
						const condition = eval("`" + templates[action.condition.type] + "`");
						action.condition = condition;
					} catch (e) {
						Log.write(e.toString());
					}
				}
			}
		}
		
		this.nodes = data.nodes.map(nodeData => new Node(nodeData, environment));
		this.startNode = data.startNode;
		this.code = code || "";
	}

	getNodeById (nodeId) {
		return this.nodes.find(node => node.id == nodeId);
	}
}

class Environment {

	constructor () {
		this.sources = {};
		this.sources["http"] = new HttpSource({host: ""});

		this.flows = {};
		this.tables = {};

		this.actionMap = {
			"transition": TransitionAction,
			"form": FormAction,
			"end": EndAction,
			"load": LoadAction,
			"exec": ExecAction,
			"set": SetAction,
			"wait": WaitAction,
			"save": SaveAction,
			"log": LogAction,
			"flow": FlowAction,
			"table": TableAction
		};
	}

	setSource (name, source) {
		this.sources[name] = source;
	}

	getSource (name) {
		if (!(name in this.sources)) {
			Log.write("Source with name '" + name + "' doesn't exist");
		} else {
			return this.sources[name];
		}
	}

	setFlow (name, flow) {
		this.flows[name] = flow;
	}

	async getFlow (name) {
		if (!(name in this.flows)) {
			Log.write("Flow with name '" + name + "' doesn't exist");
		} else {
			return this.flows[name];
		}
	}

	setTable (name, table) {
		this.tables[name] = table;
	}

	async getTable (name) {
		if(!(name in this.tables)) {
			Log.write("Table with name '" + name + "' doesn't exist");
		} else {
			return this.tables[name];
		}
	}

	setAction (key, action) {
		this.actionMap[key] = action;
	}
}

function parseData (data, state, config) {
	try {
		JSON.stringify(data);
	} catch (e) {
		throw new Error("Trying to parse circular structure");
	}

	function recursiveParse (data) {
		if (typeof data != "object") return data;

		if (Array.isArray(data)) return data.map(d => recursiveParse(d));

		const result = {};

		for (const key in data) {
			if (key.startsWith("$")) {
				const func = new Function("state, config", "with (config) { with (state) { return " + data[key] + "}}");
				result[key.substr(1)] = func(state, config);
			} else {
				result[key] = recursiveParse(data[key]);
			}
		}

		return result;
	}

	return recursiveParse(data);
}

class Instance {

	constructor (graph, environment, state = {}, config = {}, onEnd = undefined, takeSnapshots = true, onNodeStart = undefined, onNodeEnd = undefined) {
		this.id = Random.generateId(16);
		this.graph = graph;
		this.environment = environment;
        this.state = state || {};
		this.config = parseData(Object.assign(JSON.parse(JSON.stringify(graph.config || {})), config || {}), this.state, {});
		this.onEnd = onEnd;
		this.running = false;
		this.takeSnapshots = takeSnapshots;
		this.snapshots = [];
		this.trace = [];
		this.lastResult = undefined;
		this.onNodeStart = onNodeStart;
		this.onNodeEnd = onNodeEnd;
	}

	async start (data) {
		this.goto(this.graph.startNode);

		this.running = true;
		return await this.continue(data);
	}

	end (data) {
		this.running = false;
		if (this.onEnd) this.onEnd(this, data);
	}

	debugError (e, message) {
		return new Error((message || "Error") + " in flow " + this.graph.code + " at step " + this.activeNode.label + " at element " + this.actionIndex + ": " + e.toString());
	}

	clearEvent () {
		delete this.state._eventTypes;
		delete this.state._eventKey;
	}

	async continue (data) {
		if (!this.running) return;

		if (this.takeSnapshots) this.snapshots.push(this.createSnapshot(data));

		if (this.childFlow) {
			const childResult = await this.childFlow.continue(data);
			if (childResult) return childResult;
		}

		if ("_eventKey" in this.state) {
			if ("_eventTypes" in this.state) {
				if (!("type" in data && this.state._eventTypes.some(type => data.type == type))) return {};
			}

			this.state[this.state._eventKey] = data;

			this.clearEvent();
		} else {
			for (const key in data) {
				this.state[key] = data[key];
			}
		}

		for (let iteration = 0; ; iteration++) {
			if (iteration > 100) {
				throw this.debugError(new Error("Exceeded maximum number of iterations"));
			}
			
			if (this.actionIndex >= this.activeNode.actions.length) {
				throw this.debugError(new Error("No more actions"));
			}

            const action = this.activeNode.actions[this.actionIndex];

			let conditionResult = false;
			try {
				conditionResult = action.condition(this.state, this.config);
			} catch (e) {
				throw this.debugError(e, "Error while evaluation condition '" + action.conditionText + "'" + JSON.stringify(this.config));
			}

			if (conditionResult) {
				// Stop is the action returns false (indicating that the flow should wait for new data)
				// or if the flow ended
				try {
					const actionResult = await action.execute(this, data);
                    
                    if (!this.state._loop && !(action instanceof TransitionAction)) {
                        this.actionIndex++;
                    }

					if (actionResult || !this.running) {
						this.lastResult = actionResult;
						return actionResult;
					}
				} catch (e) {
					throw this.debugError(e, "Error while executing action");
				}
			} else {
                this.actionIndex++;
            }
		}
	}

	async receive (data) {
		await this.continue(data);
	}

	goto (nodeId) {
		if (this.activeNode && this.onNodeEnd) this.onNodeEnd(this, this.activeNode);

		this.activeNode = this.graph.getNodeById(nodeId);
		this.actionIndex = 0;
		this.trace.push(nodeId);

		if (this.onNodeStart) this.onNodeStart(this, this.activeNode);
	}

	set (key, value) {
		this.state[key] = value;
	}

	createSnapshot (data, includeHistory) {
		const snapshot = {
			id: this.id,
			nodeId: this.activeNode.id,
			actionIndex: this.actionIndex,
			state: Obj.clone(this.state),
			data: data,
			lastResult: Obj.clone(this.lastResult),
			running: this.running,
			trace: this.trace.slice()
		};

		if (this.childFlow) {
			snapshot.childFlowCode = this.childFlow.graph.code;
			snapshot.childFlowSnapshot = this.childFlow.createSnapshot(data, false);
		}

		if (includeHistory) {
			snapshot.origin = this.snapshots[0];
			snapshot.changes = [];
			
			for (let i = 1; i < this.snapshots.length; i++) {
				const changes = Obj.findChanges(this.snapshots[i], this.snapshots[i - 1]);
				snapshot.changes.push(changes);
			}
		}

		return snapshot;
	}	

	async back () {
		if (this.snapshots.length < 2) return;

		const snapshot = this.snapshots.splice(-2, 2)[0];

		if (this.onNodeEnd && this.activeNode && this.activeNode.id != snapshot.nodeId) {
			this.onNodeEnd(this, this.activeNode);
		}

		// execute onNodeStart if back to startNode (goto function not called)
		let toStartNode = false;
		if (this.onNodeStart && this.activeNode && this.activeNode.id != snapshot.nodeId && snapshot.nodeId == this.graph.startNode) {
			toStartNode = true;
		}

		await this.restoreSnapshot(snapshot);

		if (toStartNode) {
			this.onNodeStart(this, this.activeNode);
		}

		return await this.continue(snapshot.data);
	}

	async restoreSnapshot (snapshot) {
		if (snapshot.origin) {
			this.snapshots = [snapshot.origin];

			for (const changes of snapshot.changes) {
				let newSnapshot = Obj.clone(this.snapshots[this.snapshots.length - 1]);

				for (const change of changes) {
					Obj.deepSet(newSnapshot, change.key.split("."), change.newValue, change.oldValue);
				}

				newSnapshot = Obj.filterUndefined(newSnapshot);

				this.snapshots.push(newSnapshot);
			}
		}

		if (snapshot.childFlowCode) {
			if (!this.childFlow) {
				const childSnapshots = [];
				let beforeChild = undefined;
				for (let i = this.snapshots.length - 1; i >= 0; i--) {
					const snap = this.snapshots[i];
					if (snap.childFlowCode == snapshot.childFlowCode) childSnapshots.push(snap);
					else {
						beforeChild = snap;
						break;
					}
				}
				childSnapshots.reverse();

				if (!beforeChild) throw new Error("Could't find shapshot before child flow: " + snapshot.childFlowCode);

				await this.restoreSnapshot(beforeChild);

				this.takeSnapshots = false;
				await this.continue(beforeChild.data);
				this.takeSnapshots = true;

				if (this.childFlow) this.childFlow.snapshots.push(...childSnapshots.map(snap => snap.childFlowSnapshot));
			}

			await this.childFlow.restoreSnapshot(snapshot.childFlowSnapshot);
		} else if (!snapshot.childFlowCode && this.childFlow) {
			delete this.childFlow;
		}

		this.id = snapshot.id;
		this.activeNode = this.graph.getNodeById(snapshot.nodeId);
		this.actionIndex = snapshot.actionIndex;
		this.state = snapshot.state;
		this.running = snapshot.running;
		this.trace = snapshot.trace;
		this.lastResult = snapshot.lastResult;
	}

	getDebug (debug) {
		if (!debug) debug = [];

		debug.push({
			id: this.id,
			state: this.state,
			activeNode: this.activeNode,
			code: this.graph.code,
			trace: this.trace
		});

		if (this.childFlow) return this.childFlow.getDebug(debug);

		return debug;
	}

	getLastResult () {
		if (this.childFlow) return this.childFlow.getLastResult();

		return this.lastResult;
	}
}

module.exports = {Graph, Instance, Environment, HttpSource, Source, Action, parseData};