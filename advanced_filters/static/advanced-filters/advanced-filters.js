let AdvancedFiltersRow = function($, row, debug_mode){
	const ADVANCED_FILTER_ROW_CLASS = 'advanced_filter_row';
	const OR_VALUE = "_OR";
	let self = this;
	self.row = $(row);
	self.row_id = self.row.attr('id');
	self.operator_select = self.row.find('select.query-operator');
	self.query_value = self.row.find('select.query-value');
	self.query_field_name = self.row.find('.query-field');
	self.debug_mode = debug_mode || true;

	self.log = function() {
		if (self.debug_mode){
			console.log.apply(this, arguments);
		}
	};

	self.init = function () {
		if (self.row.hasClass(ADVANCED_FILTER_ROW_CLASS)){
			console.error('Row already initialized!');
			return;
		}

		self.remove_operators_factory = {
			'iexact': self.remove_select2,
			'icontains': self.remove_select2,
			'iregex': self.remove_select2,
			'range': self.remove_datepickers,
			'isnull': self.remove_static,
			'istrue': self.remove_static,
			'isfalse': self.remove_static,
			'lt': self.remove_select2,
			'gt': self.remove_select2,
			'lte': self.remove_select2,
			'gte': self.remove_select2,
		};

		self.operators_factory = {
			'iexact': self.initialize_select2,
			'icontains': self.initialize_select2_icontains,
			'iregex': self.initialize_select2_iregex,
			'range': self.initialize_datepickers,
			'isnull': self.initialize_static,
			'istrue': self.initialize_static,
			'isfalse': self.initialize_static,
			'lt': self.initialize_select2,
			'gt': self.initialize_select2,
			'lte': self.initialize_select2,
			'gte': self.initialize_select2,
		};

		self.row.addClass(ADVANCED_FILTER_ROW_CLASS);
		self.query_field_name.select2({dropdownParent: $(self.row),});
		self.query_field_name.on('change', function(){
			self.on_field_name_changed()
		});
		self.operator_select.select2({dropdownParent: $(self.row),});
		self.operator_select.on('change', function(){
            self.on_operator_changed()
        });
		self.on_field_name_changed(true);
		self.on_operator_changed()
	};

	self.destroy = function(){
		self.log('self.destroy');
		let operator = self.get_current_operator();
		let remove_handler = self.get_from_factory(self.remove_operators_factory, operator, self.hide_default);
		remove_handler();
		self.operator_select.off();
	};

	self.get_current_operator = function(){
		return self.operator_select.val();
	};

	self.get_current_query_field = function(){
		return self.query_field_name.val();
	};

	self.on_field_name_changed = function(force){
		force = force || false;
		let previous_value = self.query_field_name.data('previous_value');
		let current_value = self.get_current_query_field();
		let previous_is_or = previous_value === OR_VALUE;
		let current_is_or = current_value === OR_VALUE;
		let is_changed = previous_is_or !== current_is_or;
		if (is_changed){
			if (current_is_or){
				self.operator_select
					.select2('destroy')
					.val('icontains');

				self.operator_select.find('option')
					.each(function () {
						if($(this).val() != 'icontains') {
							$(this).prop('disabled', 'disabled')
						}
					});
				self.on_operator_changed(true);
				self.query_value
					.val('-')
					.prop("readonly", 'readonly');
			} else {
				self.operator_select
					.find('option')
					.each(function () {
						$(this).removeAttr('disabled')
					});
				self.operator_select
					.select2({dropdownParent: $(self.row),})
					.removeAttr("readonly");
				self.on_operator_changed(true);
				self.query_value
					.removeAttr("readonly");
			}
		}

		self.query_field_name.data('previous_value', current_value);

		if (!force) {
			let operator = self.get_current_operator();
			self.recreate_operators(operator, operator)
		}
	};

	self.on_operator_changed = function(force){
		if (self.debug_mode)
			console.group('on_operator_changed');
		force = !!force;

		let previous_operator = self.operator_select.data('previous_value');
		let operator = self.get_current_operator();
		self.log({
			previous_operator: previous_operator,
			operator: operator,
		});
		if (previous_operator === operator && !force){
			if (self.debug_mode)
				console.groupEnd();
			return
		}

		self.recreate_operators(previous_operator, operator);
		self.operator_select.data('previous_value', operator);
		if (self.debug_mode)
			console.groupEnd();
	};


	self.recreate_operators = function(previous_operator, current_operator) {
		let remove_handler = self.get_from_factory(self.remove_operators_factory, previous_operator, self.hide_default);
		let initialize_handler = self.get_from_factory(self.operators_factory, current_operator, self.initialize_default);
		remove_handler();
		initialize_handler();
	};

	self.get_from_factory = function(factory, operator, default_handler){
		return factory[operator] || default_handler;
	};

	self.remove_static = function() {
		self.query_value.parent().find('.static_text').remove();
	};

	self.initialize_static = function() {
		var text = self.operator_select.find('option:selected').text();
		let static_item = $('<span class="static_text"></span>').text(text);
		self.query_value.parent().append(static_item)
	};

	self.initialize_default = function(){
		self.log('self.initialize_default');
		self.query_value
			.removeAttr('disabled')
			.show();
	};

	self.hide_default = function(){
		self.log('self.hide_default');
		self.query_value
			.attr('disabled', 'disabled')
			.hide();
	};

	self.s2_create_tag = function(params){
		let term = $.trim(params.term);
		if (term === '') {
			return null;
		}
		return {
			id: term,
			text: term,
			newTag: true,
		};
	};

	self.initialize_select2_icontains = function() {
		self.log('self.initialize_select2_icontains');
		let query_value_clone = self.query_value.clone()
			.removeAttr('disabled')
			.addClass('select2_query')
			.show();
		self.query_value.parent().append(query_value_clone);
		query_value_clone.select2({
			dropdownParent: $(self.row),
			tags: true,
			allowClear: true,
			createTag: self.s2_create_tag,
		});
	};

	self.initialize_select2_iregex = function(){
		self.log('self.initialize_select2_iregex');
		let operator = self.get_current_operator();
		let field_name = self.get_current_query_field();

		let choices_url = ADVANCED_FILTER_CHOICES_LOOKUP_URL + (FORM_MODEL || MODEL_LABEL) + '/' + field_name;
		$.get(choices_url, function(data) {
			let n_operator = self.get_current_operator();
			let n_field = self.get_current_query_field();
			if(n_operator !== operator || n_field !==field_name){
				return;
			}

			self.log('choices response', {choices_url: choices_url, data: data});
			let query_value_clone = self.query_value.clone()
				.removeAttr('disabled')
				.addClass('select2_query')
				.show();
			self.query_value.parent().append(query_value_clone);
			query_value_clone.select2({
				dropdownParent: $(self.row),
				multiple: true,
				data: data.results,
				tags: true,
				createTag: self.s2_create_tag,
			})
		}).fail(function() {
			let n_operator = self.get_current_operator();
			let n_field = self.get_current_query_field();
			if(n_operator !== operator || n_field !==field_name){
				return;
			}
			self.initialize_default();
		});
	};

	self.initialize_select2 = function() {
		self.log('self.initialize_select2');
		let operator = self.get_current_operator();
		let field_name = self.get_current_query_field();

		let choices_url = ADVANCED_FILTER_CHOICES_LOOKUP_URL + (FORM_MODEL || MODEL_LABEL) + '/' + field_name;
		$.get(choices_url, function(data) {
			let n_operator = self.get_current_operator();
			let n_field = self.get_current_query_field();
			if(n_operator !== operator || n_field !==field_name){
				return;
			}

			self.log('choices response', {choices_url: choices_url, data: data});
			let query_value_clone = self.query_value.clone()
				.removeAttr('disabled')
				.addClass('select2_query')
				.show();
			self.query_value.after(query_value_clone);
			query_value_clone.select2({
				dropdownParent: $(self.row),
				data: data.results,
				multiple: false,
				tags: true,
    			allowClear: true,
				createTag: self.s2_create_tag,
			});
			// debugger;

		}).fail(function() {
			let n_operator = self.get_current_operator();
			let n_field = self.get_current_query_field();
			if(n_operator !== operator || n_field !==field_name){
				return;
			}

			self.initialize_default();
		});
	};

	self.remove_select2 = function() {
		self.log('self.remove_select2');
		self.row.find('.select2_query')
			.select2("destroy")
			.remove();
		self.hide_default();
	};

	self.initialize_datepickers = function() {
		self.log('self.initialize_datepickers');
		let form_id = self.row_id;
		let form_num = parseInt(form_id.replace('form-', ''), 10);

		self.log('self.add_datepickers: form_id='+form_id+' form_num='+form_num);

		let $from = $('<input type="date">')
			.attr({
				"name": "form-" + form_num + "-value_from",
				"id": "id_form-" + form_num + "-value_from",
				"placeholder": gettext('Start date (YYYY-MM-DD)'),
			})
			.addClass('query-dt-from form-control form-control-sm');
		let $to = $('<input type="date">')
			.attr({
				"name": "form-" + form_num + "-value_to",
				"id": "id_form-" + form_num + "-value_to",
				"placeholder": gettext('End date (YYYY-MM-DD)'),
			})
			.addClass('query-dt-to form-control form-control-sm');

		self.query_value.after($to);
		self.query_value.after($from);

		let val = self.query_value.val();
		if (Array.isArray(val) && val.length > 0){
			val = val[0]
		}
		if (!val || val === 'null') {
			self.query_value.val("-");
		} else {
			let from_to = val.split(',');
			if (from_to.length === 2) {
				$from.val(from_to[0]);
				$to.val(from_to[1])
			}
		}
		$from.addClass('hasDatepicker');
		$to.addClass('hasDatepicker');
	};

	self.remove_datepickers = function() {
		self.log('self.remove_datepickers');
		$(self.query_value.parent()).find(".hasDatepicker").remove();
	};
};
