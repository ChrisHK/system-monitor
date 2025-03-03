const Joi = require('joi');

const dataProcessSchema = Joi.object({
    source: Joi.string().required(),
    timestamp: Joi.date().iso().required(),
    batch_id: Joi.string().required(),
    items: Joi.array().items(
        Joi.object({
            serialnumber: Joi.string().required(),
            computername: Joi.string().required(),
            manufacturer: Joi.string().required(),
            model: Joi.string().required(),
            touchscreen: Joi.string().valid('Yes', 'Yes Detected', 'No', 'Not Detected'),
            ram_gb: Joi.number().integer().min(0),
            disks: Joi.array().items(
                Joi.object({
                    size_gb: Joi.number().integer().min(0)
                })
            ),
            battery: Joi.object({
                design_capacity: Joi.number().integer().min(0),
                cycle_count: Joi.number().integer().min(0),
                health: Joi.number().min(0).max(100)
            })
        })
    ).min(1).required(),
    metadata: Joi.object({
        total_items: Joi.number().integer().required(),
        version: Joi.string().required(),
        checksum: Joi.string().required()
    }).required()
});

module.exports = dataProcessSchema;
