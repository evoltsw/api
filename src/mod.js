let connected = false;
let challenging = false;

const initBody = {
	version: "0.0.1",

}

const projectProxyHandler = {
	get(_, prop) {
		switch(prop) {
			case "undo": {

			}
		}
	}
}


const requestMap = {};

const createInterface = (port, callback) => {
	const resolverRegistry = {};
	let requestId = 0;
	port.onmessage = async ({ data: { type, body, resolveId } }) => {
		if(type == "resolve") {
			resolverRegistry[resolveId]?.(body);
			requestId = resolveId < requestId ? resolveId : requestId;
			delete resolverRegistry[resolveId];
		} else {
			port.postMessage({ type: "resolve", body: await callback[type]?.(body), resolveId });
		}
	}
	return (data) => {
		if(data.abort) {
			while(requestId++ in resolverRegistry) {};
		}
		port.postMessage(Object.assign(data, { requestId }), data.transfer);
		return data.abort ? undefined : new Promise(resolve => resolverRegistry[requestId] = resolve)
	}
}

const resolver = (resolveConnect, reject) => {

	if(connected || challenging) reject();

	challenging = true;

	const eventListenerFnRegistry = {};

	const msgHandler = ({ data: { type, body }, appPort, postRequest }) => {
		switch(type) {
			case "init": {
				if(!body) return;

				const basicInterface = Object.freeze({

					client: {

						notify: {
							log(message) {
								postRequest({ type: "notify", body: { message, type: "log" }, abort: true });
								return this;	
							},

							warn(message) {
								postRequest({ type: "notify", body: { message, type: "warn" }, abort: true })
							},

							error(message) {
								postRequest({ type: "notify", body: { message, type: "error" }, abort: true })
							},

							async progress(message) {
								const target = await postRequest({ type: "notify", body: { message, type: "progress" } });
								return {
									set rate(rateValue) {
										postRequest({ type: undefined, body: { id: target, action: "set", target: "rate", newValue: rateValue } })
									},
									set message(messageText) {
										postRequest({ type: undefined, body: { id: target, action: "set", target: "message", newValue: rateValue } })
									}
								}
							},

							async confirm(message, options) {
								await postRequest({ type: "notify", body: { message, type: "confirm", options } });
							}

						},

						frameX: 0,
						frameY: 0,

						set onresize(callbackFn) {
							eventListenerFnRegistry.resize.push(callbackFn);
						}
					},

					project: {
						async undo() {
							
						},
						async redo() {

						},
					},

					storage: new Proxy({}, {
						get(_, prop) {
							postRequest({ type: "storage", body: { prop, type: "get" } })
						},
						set(_, value, prop) {
							postRequest({ type: "storage", body: { prop, type: "set", value } })
						}
					})
				})

				resolveConnect(basicInterface)
			}
			case "return": {

			}
			case "eventemit": {
				const { eventType, eventData } = body;
				eventListenerFnRegistry[eventType]?.forEach(callbackFn => callbackFn(eventData));
			}
		}
	}

	const initListener = ({ data: { appPort, initNonce, serializedModuleFn } }) => {
		// if(connected || challenging) return;
		if(!appPort instanceof MessagePort) {
			challenging = false;
			return;
		};

		// const { appPort } = data;

		const postRequest = createInterface(appPort);

		addEventListener("contextmenu", e => {
			e.preventDefault();
			const { clientX, clientY } = e;
			postRequest({ type: "contextmenu", body: { clientX, clientY } })
		}, { passive: false });

		connected = true;
		removeEventListener("message", initListener, { passive: true });

		appPort.postMessage({ type: "init", body: { initNonce } });
		appPort.onmessage = ({ data }) => msgHandler({ data, appPort, postRequest });
	};

	addEventListener("message", initListener, { passive: true })
}

/**
 * 
 * @returns { Promise<object> }
 */


export const { project, client } = await new Promise(resolver);