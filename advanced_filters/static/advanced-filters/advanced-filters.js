let AdvancedFiltersRow = function($, row, debug_mode){
	const ADVANCED_FILTER_ROW_CLASS = 'advanced_filter_row';
	const OR_VALUE = "_OR";
	let self = this;
	self.row = $(row);
	self.row_id = self.row.attr('id');
	self.operator_select = self.row.find('select.query-operator');
	self.query_value = self.row.find('input.query-value');
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
			'range': self.remove_datepickers,
			'iregex': self.remove_select2,
		};

		self.operators_factory = {
			'iexact': self.initialize_select2,
			'range': self.initialize_datepickers,
			'iregex': self.initialize_select2,
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
		let operator = self.operator_select.val();
		let remove_handler = self.get_from_factory(self.remove_operators_factory, operator, self.hide_default);
		remove_handler();
		self.operator_select.off();
	};

	self.on_field_name_changed = function(force){
		force = force || false;
		let previous_value = self.query_field_name.data('previous_value');
		let current_value = self.query_field_name.val();
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
			let operator = self.operator_select.val();
			self.recreate_operators(operator, operator)
		}
	};

	self.on_operator_changed = function(force){
		if (self.debug_mode)
			console.group('on_operator_changed');
		force = !!force;

		let previous_operator = self.operator_select.data('previous_value');
		let operator = self.operator_select.val();
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

	self.initialize_default = function(){
		self.log('self.initialize_default');
		self.query_value.show();
	};

	self.hide_default = function(){
		self.log('self.hide_default');
		self.query_value.hide();
	};

	self.initialize_select2 = function() {
		self.log('self.initialize_select2');
		let field_name = self.query_field_name.val();

		let choices_url = ADVANCED_FILTER_CHOICES_LOOKUP_URL + (FORM_MODEL || MODEL_LABEL) + '/' + field_name;
		$.get(choices_url, function(data) {
			self.log('choices response', {choices_url: choices_url, data: data});
			let query_value_clone = self.query_value.clone()
				.addClass('select2_query')
				.show();
			self.query_value.after(query_value_clone);
			query_value_clone.select2({
				dropdownParent: $(self.row),
				// multiple: true, //TODO: подумать над возможностью мультивыбора для типа "One Of"
				data: data.results,
				createTag: function (params) {
					let term = $.trim(params.term);
					if (term === '') {
						return null;
					}

					return {
					  id: term,
					  text: term,
					  newTag: true
					}
				},
			});
		}).fail(function() {
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
