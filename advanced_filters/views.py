from operator import itemgetter
import logging

from django.apps import apps
from django.conf import settings
from django.contrib.admin.sites import all_sites
from django.contrib.admin.utils import get_fields_from_path
from django.db import models
from django.db.models.fields import FieldDoesNotExist
from django.utils.encoding import force_text
from django.views.generic import View

from braces.views import (CsrfExemptMixin, StaffuserRequiredMixin,
                          JSONResponseMixin)

logger = logging.getLogger('advanced_filters.views')


def get_django_model_admin(model):
    """Search Django ModelAdmin for passed model.
    Returns instance if found, otherwise None.
    """
    for admin_site in all_sites:
        registry = admin_site._registry
        if model in registry:
            return registry[model]
    return None

class GetFieldChoices(CsrfExemptMixin, StaffuserRequiredMixin,
                      JSONResponseMixin, View):
    """
    A JSONResponse view that accepts a model and a field (path to field),
    resolves and returns the valid choices for that field.
    Model must use the "app.Model" notation.

    If this field is not a simple Integer/CharField with predefined choices,
    all distinct entries in the DB are presented, unless field name is in
    ADVANCED_FILTERS_DISABLE_FOR_FIELDS and limited to display only results
    under ADVANCED_FILTERS_MAX_CHOICES.
    """
    def get(self, request, model=None, field_name=None):
        if model is field_name is None:
            return self.render_json_response(
                {'error': "GetFieldChoices view requires 2 arguments"},
                status=400)
        app_label, model_name = model.split('.', 1)
        try:
            initial_model_obj = model_obj = apps.get_model(app_label, model_name)
            field = get_fields_from_path(model_obj, field_name)[-1]
            model_obj = field.model  # use new model if followed a ForeignKey

            # Check if field available to display choices
            model_admin = get_django_model_admin(initial_model_obj)
            if not model_admin:
                return self.render_json_response({'error': f"Model Admin not found"}, status=400)
            adv_filter_form_class = getattr(model_admin, 'advanced_filter_form', None)
            if not adv_filter_form_class:
                return self.render_json_response({'error': "No installed app/model: %s" % model}, status=400)
            adv_filter_form = adv_filter_form_class(model_admin=model_admin)
            fields = adv_filter_form.get_fields_from_model(initial_model_obj, adv_filter_form._filter_fields)
            if field_name not in fields:
                return self.render_json_response({'error': f"Field not found"}, status=400)

        except AttributeError as e:
            logger.debug("Invalid kwargs passed to view: %s", e)
            return self.render_json_response(
                {'error': "No installed app/model: %s" % model}, status=400)
        except (LookupError, FieldDoesNotExist) as e:
            logger.debug("Invalid kwargs passed to view: %s", e)
            return self.render_json_response(
                {'error': force_text(e)}, status=400)

        choices = field.choices
        # if no choices, populate with distinct values from instances
        if not choices:
            choices = []
            disabled = getattr(settings, 'ADVANCED_FILTERS_DISABLE_FOR_FIELDS',
                               tuple())
            max_choices = getattr(settings, 'ADVANCED_FILTERS_MAX_CHOICES', 254)
            if field.name in disabled:
                logger.debug('Skipped lookup of choices for disabled fields')
            elif isinstance(field, (models.BooleanField, models.DateField,
                                    models.TimeField)):
                logger.debug('No choices calculated for field %s of type %s',
                             field, type(field))
            else:
                # the order_by() avoids ambiguity with values() and distinct()
                choices = model_obj.objects.order_by(field.name).values_list(
                    field.name, flat=True).distinct()
                # additional query is ok to avoid fetching too many values
                if choices.count() <= max_choices:
                    choices = zip(choices, choices)
                    logger.debug('Choices found for field %s: %s',
                                 field.name, choices)
                else:
                    choices = []

        results = [{'id': c[0], 'text': force_text(c[1])} for c in sorted(
                   choices, key=itemgetter(0))]

        return self.render_json_response({'results': results})
