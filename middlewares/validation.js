const validate = (schema) => async (req, res, next) => {
  try {
    await schema.validate(req.body, { abortEarly: false });
    next();
  } catch (error) {
    res.status(400);
    // Passing error.errors if available (like with Yup), otherwise fallback to error.message
    next(new Error(error.errors ? error.errors.join(', ') : error.message));
  }
};

module.exports = { validate };
