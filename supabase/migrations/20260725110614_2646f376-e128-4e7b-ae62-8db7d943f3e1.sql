CREATE OR REPLACE FUNCTION public.validate_gd_entry_custom_value()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f record;
  opt_field uuid;
BEGIN
  SELECT id, name, field_type, is_mandatory
    INTO f
  FROM public.custom_fields
  WHERE id = NEW.custom_field_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown or deleted custom field';
  END IF;

  IF f.field_type IN ('dropdown', 'radio') THEN
    IF NEW.custom_field_option_id IS NULL THEN
      IF f.is_mandatory THEN
        RAISE EXCEPTION '% requires a selection', f.name;
      END IF;
    ELSE
      SELECT custom_field_id INTO opt_field
      FROM public.custom_field_options
      WHERE id = NEW.custom_field_option_id AND deleted_at IS NULL;

      IF opt_field IS NULL OR opt_field <> NEW.custom_field_id THEN
        RAISE EXCEPTION 'Invalid option selected for %', f.name;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Non-option field types use the text value column
  IF NEW.value IS NULL OR btrim(NEW.value) = '' THEN
    IF f.is_mandatory THEN
      RAISE EXCEPTION '% is required', f.name;
    END IF;
    RETURN NEW;
  END IF;

  IF length(NEW.value) > 2000 THEN
    RAISE EXCEPTION '% must be 2000 characters or fewer', f.name;
  END IF;

  IF f.field_type = 'number' THEN
    IF NEW.value !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
      RAISE EXCEPTION '% must be a number', f.name;
    END IF;
  ELSIF f.field_type = 'date' THEN
    BEGIN
      PERFORM NEW.value::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION '% must be a valid date', f.name;
    END;
  END IF;

  NEW.value := btrim(NEW.value);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_gd_entry_custom_value_trg ON public.gd_entry_custom_values;
CREATE TRIGGER validate_gd_entry_custom_value_trg
BEFORE INSERT OR UPDATE ON public.gd_entry_custom_values
FOR EACH ROW EXECUTE FUNCTION public.validate_gd_entry_custom_value();