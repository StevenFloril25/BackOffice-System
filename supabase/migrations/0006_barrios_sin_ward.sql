-- Los barrios vienen del sistema de inscripción en inglés ("Eden Ward",
-- "Pedernales Branch"). Se muestran solo con su nombre: "Eden", "Pedernales".
-- La importación limpia el nombre igual antes de buscar el barrio, así que
-- volver a importar el Excel encuentra estos mismos barrios en vez de crear
-- otros con "Ward".

update barrios
set nombre = btrim(regexp_replace(nombre, '\s+(ward|branch)\s*$', '', 'i'))
where nombre ~* '\s+(ward|branch)\s*$';
