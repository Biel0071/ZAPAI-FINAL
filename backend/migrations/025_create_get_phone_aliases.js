module.exports = {
  version: '025_create_get_phone_aliases',
  description: 'Create get_phone_aliases function for PostgreSQL to handle Brazilian 9-digit phone variations',
  up: async (client) => {
    await client.query(`
      CREATE OR REPLACE FUNCTION get_phone_aliases(input_phone text)
      RETURNS text[] AS $$
      DECLARE
        cleaned text;
        aliases text[];
        ddd text;
        rest text;
      BEGIN
        cleaned := regexp_replace(input_phone, '\\D', '', 'g');
        aliases := ARRAY[cleaned];
        
        -- Check if it is a Brazilian number with country code (starts with 55 and has 12 or 13 digits)
        IF cleaned LIKE '55%' AND length(cleaned) IN (12, 13) THEN
          ddd := substring(cleaned from 3 for 2);
          rest := substring(cleaned from 5);
          
          -- If it has 13 digits (with 9th digit)
          IF length(cleaned) = 13 AND substring(rest from 1 for 1) = '9' THEN
            -- Add alias without 9th digit
            aliases := aliases || ('55' || ddd || substring(rest from 2));
          -- If it has 12 digits (without 9th digit)
          ELSIF length(cleaned) = 12 THEN
            -- Add alias with 9th digit
            aliases := aliases || ('55' || ddd || '9' || rest);
          END IF;
        END IF;

        RETURN aliases;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
  },
};
