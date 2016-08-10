var redis = require('redis');
var crypto = require('crypto');

module.exports = function(config){
	var context = this;
	var servicesChannel = config.channel || "services-" + (process.env.NODE_ENV || "development");
	var services = {};

	var client = redis.createClient(config);
	var pub = redis.createClient(config);

	var getServices = function(){
		return services;
	}

	var announce = function(serviceInfo){

		var serviceName = serviceInfo.name;

		var id = generateRandomId(serviceName, serviceInfo);

		services["self"] = {
			name: serviceName,
			id: id,
			info: serviceInfo
		}

		client.on("subscribe", function(channel){
			broadcastInfo();
			context.events.emit("announce");
		})

		client.on("message", function(channel, message){
			var service = JSON.parse(message);
			if(service.type === "remove"){
				if(!services[service.name]){
					return
				}
				if(!services[service.name][service.id]){
					return
				}
				delete services[service.name][service.id];
				context.events.emit("disconnect", service);
				console.log(services)
			}

			else if(service.type === "announce"){
				if(service.id === services.self.id){
					return;
				}
				if(!services.hasOwnProperty(service.name)){
					services[service.name] = {};
				}
				if(!services[service.name][service.id]){
					services[service.name][service.id] = {
						name: service.name,
						id: service.id,
						info: service.info
					}
					broadcastInfo();

					context.events.emit("connection", service);

					console.log(services)
				}
			}
		})

		client.subscribe(servicesChannel);

		function broadcastInfo(){
			pub.publish(servicesChannel, JSON.stringify({
				name: serviceName,
				id: id,
				type: "announce",
				info: serviceInfo
			}))
		}
	}

	var remove = function(){
		pub.publish(servicesChannel, JSON.stringify({
			name: services.self.name,
			id: services.self.id,
			type: "remove"
		}))

		client.unsubscribe();
		client.quit();
	}

	return {
		announce: announce,
		remove: remove,
		services: getServices
	}
}

function generateRandomId(serviceName, serviceInfo){
	var array = [Math.random().toString(), serviceName, JSON.stringify(serviceInfo), Date.now().toString()];
	
	array.reduce(function(acc, val, i){
		var newIndex = Math.floor(Math.random() * array.length);
		array[i] = array[newIndex];
		array[newIndex] = val;
	})

	return crypto.createHash('sha256')
	.update(array[0])
	.update(array[1])
	.update(array[2])
	.update(array[3])
	.digest("hex");
}
