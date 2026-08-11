su - postgres -c "psql -d zapai_crm -c 'UPDATE conversations SET ai_enabled = true, ai_reactivate_at = NULL;'"
