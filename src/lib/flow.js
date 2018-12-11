const HTTP = require("../netjs/http.js");
const Log = require("../netjs/log.js");

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
			this.condition = new Function("state, config", "with (state) {return " + (condition || "true") + "}");
		} catch (e) {
			Log.write("Invalid condition: " + condition);
			this.condition = new Function("state, config", "return true");
		}
	}

	// abstract method
	async execute (instance) {
		throw new Error("Class doesn't implement method Action.execute");
	}
}

class LogAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance) {
		const data = parseData(this.data, instance.state, instance.config);

		Log.write(data.message);
		return false;
	}
}

class WaitAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance) {
		const data = parseData(this.data, instance.state, instance.config);

		instance.eventKey = data.outputKey;
		instance.eventTypes = data.types;
		return data;
	}
}

class SetAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance) {
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

	async execute (instance) {
		const func = new Function("state, config", "with (state) {" + this.data.join(";") + "}");
		func(instance.state, instance.config);
		return false;
	}
}

class LoadAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance) {
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

	async execute (instance) {
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

	async execute (instance) {
		const data = parseData(this.data, instance.state, instance.config);

		instance.goto(data.nodeId);
		return false;
	}
}

class FormAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance) {
		const data = parseData(this.data, instance.state, instance.config);
		return data;
	}
}

class FlowAction extends Action {
	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance) {
		const data = parseData(this.data, instance.state, instance.config);
		let flow = (await instance.environment.getFlow(data.name)).tree;
		
		instance.childFlow = new Instance(flow, instance.environment, data.stateObj || data.state, data.configObj || data.config, (childInstance, returnData) => {
			if (data.outputKey) instance.state[data.outputKey] = returnData;
			delete instance.childFlow;
		});

		return await instance.childFlow.start({});
	}
}

class EndAction extends Action {

	constructor (data, condition) {
		super(data, condition);
	}

	async execute (instance) {
		const data = parseData(this.data || {}, instance.state, instance.config);
		instance.end(data.output);
		return false;
	}
}

const actionMap = {
	"transition": TransitionAction,
	"form": FormAction,
	"end": EndAction,
	"load": LoadAction,
	"exec": ExecAction,
	"set": SetAction,
	"wait": WaitAction,
	"save": SaveAction,
	"log": LogAction,
	"flow": FlowAction
};

class Node {

	constructor (data) {
		this.id = data.id;

		this.actions = [];
		for (const action of data.actions) {
			if (!(action.type in actionMap)) {
				Log.write("Unknown action type " + action.type + " in flow");
			} else {
				this.actions.push(new (actionMap[action.type])(action.data, action.condition));
			}
		}
	}
}

const templates = {
	custom: "${value1}",
	equal: "${value1} == ${value2}",
	notEqual: "${value1} != ${value2}",
	exists: "typeof ${value1} != \"undefined\"",
	notExists: "typeof ${value1} == \"undefined\""
};

class Graph {

	constructor (data, code) {
		// Convert config to object
		this.config = Array.isArray(data.config) ? data.config.reduce((a, v) => {
			if (v.value) a[v.key] = v.value;
			else if (v.$value) a["$" + v.key] = v.$value;
			return a;
		}, {}) : data.config;

		const reduceKeyValue = function (array) {
			const obj = array.reduce((a, v) => {
				if (v.value) a[v.key] = v.value;
				else if (v.$value) a["$" + v.key] = v.$value;
				return a;
			}, {});
			return obj;
		}

		for (let node of data.nodes) {
			// Convert node 'set' to object
			let setters = node.actions.filter(a => a.type == "set" && Array.isArray(a.data));
			for (let setter of setters) {
				setter.data = reduceKeyValue(setter.data);
			}

			// Convert flow state & config to object
			let flows = node.actions.filter(a => a.type == "flow" && (Array.isArray(a.data.state) || Array.isArray(a.data.config)));
			for (let flow of flows) {
				if (Array.isArray(flow.data.state)) {
					flow.data.stateObj = reduceKeyValue(flow.data.state);
					delete flow.data.state;
				}
				if (Array.isArray(flow.data.config)) {
					flow.data.configObj = reduceKeyValue(flow.data.config);
					delete flow.data.config;
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
		
		this.nodes = data.nodes.map(nodeData => new Node(nodeData));
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
				const func = new Function("state, config", "with (state) { return " + data[key] + "}");
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

	constructor (graph, environment, state, config, onEnd) {
		this.graph = graph;
		this.environment = environment;
		this.state = state || {};
		this.config = parseData(Object.assign(JSON.parse(JSON.stringify(graph.config || {})), config || {}), this.state, {});
		this.onEnd = onEnd;
		this.running = false;
	}

	async start (data) {
		this.activeNode = this.graph.getNodeById(this.graph.startNode);
		this.actionIndex = 0;
		this.running = true;
		return await this.continue(data);
	}

	end (data) {
		this.running = false;
		if (this.onEnd) this.onEnd(this, data);
	}

	async continue (data) {
		if (!this.running) return;

		if (this.childFlow) {
			const childResult = await this.childFlow.continue(data);
			if (childResult) return childResult;
		}

		if ("eventKey" in this) {
			if ("eventTypes" in this) {
				if (!("type" in data && this.eventTypes.some(type => data.type == type))) return {};
				delete this.eventTypes;
			}

			this.state[this.eventKey] = data;
			delete this.eventKey;
		} else {
			for (const key in data) {
				this.state[key] = data[key];
			}
		}

		for (let iteration = 0; ; iteration++) {
			if (iteration > 100) {
				throw new Error("Exceeded maximum number of iterations");
			}
			
			if (this.actionIndex >= this.activeNode.actions.length) {
				throw new Error("No more actions");
			}

			const action = this.activeNode.actions[this.actionIndex++];

			let conditionResult = false;
			try {
				conditionResult = action.condition(this.state, this.config);
			} catch (e) {
				throw new Error("Error while evaluation condition in flow " + this.graph.code + ": '" + action.conditionText + "' - " + e.toString());
			}

			if (conditionResult) {
				// Stop is the action returns false (indicating that the flow should wait for new data)
				// or if the flow ended
				const actionResult = await action.execute(this);
				if (actionResult || !this.running) {
					return actionResult;
				}
			}
		}
	}

	async receive (data) {
		await this.continue(data);
	}

	goto (nodeId) {
		this.activeNode = this.graph.getNodeById(nodeId);
		this.actionIndex = 0;
	}

	set (key, value) {
		this.state[key] = value;
	}

	getDebug () {
		if (this.childFlow) return this.childFlow.getDebug();

		return {
			state: this.state,
			activeNode: this.activeNode,
			code: this.graph.code
		};
	}
}

module.exports = {Graph, Instance, Environment, HttpSource, Source};