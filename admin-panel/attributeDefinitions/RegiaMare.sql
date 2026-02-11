-- =====================================================================================
-- ATTRIBUTE DEFINITIONS FOR REGIAMARE
-- Empresa: RegiaMare (ID: eac2ccbe-cc36-40cd-bb7e-d5fe44de972d)
-- Sector: Inmobiliaria - Venta de propiedades residenciales en España
-- =====================================================================================
-- 
-- Este archivo contiene las definiciones de atributos para propiedades inmobiliarias
-- basadas en análisis de competidores reales del mercado español:
-- - Premium Houses (https://www.premiumhouses.es)
-- - Durán Carasso (https://www.durancarasso.es)
-- - Apple Houses (https://applehouses.es)
--
-- Clasificación de atributos:
-- - is_required: TRUE = Obligatorio para publicar el item
-- - is_filterable: TRUE = Se puede usar como criterio de búsqueda
-- =====================================================================================

-- =====================================================================================
-- SECCIÓN 1: ATRIBUTOS BÁSICOS OBLIGATORIOS
-- Información fundamental que toda propiedad debe tener
-- =====================================================================================

-- 1. PRECIO (Obligatorio + Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'price', 'Precio', 'number', true, true);

-- 2. TIPO DE OPERACIÓN (Obligatorio + No Filtrable)
-- Valores típicos: "Venta", "Alquiler", "Alquiler Vacacional", "Traspaso"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'operation_type', 'Tipo de Operación', 'text', false, true);

-- 3. TIPO DE PROPIEDAD (Obligatorio + Filtrable)
-- Valores típicos: "Piso", "Casa", "Casa Pareada", "Villa", "Ático", "Dúplex", "Planta Baja", "Masía", "Local", "Terreno"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'property_type', 'Tipo de Propiedad', 'text', true, true);

-- 4. PROVINCIA (Obligatorio + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'province', 'Provincia', 'text', false, true);

-- 5. CIUDAD/MUNICIPIO (Obligatorio + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'city', 'Ciudad/Municipio', 'text', false, true);

-- 6. SUPERFICIE CONSTRUIDA (Obligatorio + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'built_surface', 'Superficie Construida (m²)', 'number', false, true);

-- 7. HABITACIONES (Obligatorio + Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'bedrooms', 'Habitaciones', 'number', true, true);

-- 8. BAÑOS (Obligatorio + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'bathrooms', 'Baños', 'number', false, true);

-- 9. ESTADO/CONDICIÓN (Obligatorio + No Filtrable)
-- Valores típicos: "Obra Nueva", "A Estrenar", "Reformado", "Buen Estado", "A Reformar", "Para Entrar a Vivir"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'condition', 'Estado', 'text', false, true);

-- 10. DESCRIPCIÓN COMPLETA (Obligatorio + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'description', 'Descripción Completa', 'longtext', false, true);

-- =====================================================================================
-- SECCIÓN 2: UBICACIÓN Y CARACTERÍSTICAS DE SUPERFICIE
-- Información geográfica y de dimensiones adicionales
-- =====================================================================================

-- 11. ZONA (Obligatorio + Filtrable)
-- Valores típicos: "Barcelona", "Sitges", "Sant Pere de Ribes", "Vilanova i la Geltrú", "Castelldefels", "Gavà", etc.
-- Este campo es fundamental para filtrado geográfico
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'zone', 'Zona', 'text', true, true);

-- 12. SUPERFICIE ÚTIL (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'usable_surface', 'Superficie Útil (m²)', 'number', false, false);

-- 13. SUPERFICIE PARCELA (Opcional + No Filtrable)
-- Para casas, villas, terrenos
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'plot_surface', 'Superficie Parcela (m²)', 'number', false, false);

-- =====================================================================================
-- SECCIÓN 3: CARACTERÍSTICAS ESTRUCTURALES Y UBICACIÓN EN EDIFICIO
-- Información sobre la posición y estructura de la propiedad
-- =====================================================================================

-- 14. PLANTA (Opcional + No Filtrable)
-- Valores típicos: "Planta Baja", "1ª Planta", "2ª Planta", "3ª Planta", "4ª Planta", "5ª Planta", "Ático", "Sótano", "Semisótano"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'floor', 'Planta', 'text', false, false);

-- 15. ASCENSOR (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_elevator', 'Ascensor', 'boolean', false, false);

-- 16. AÑO DE CONSTRUCCIÓN (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'year_built', 'Año de Construcción', 'number', false, false);

-- =====================================================================================
-- SECCIÓN 4: PARKING Y ALMACENAMIENTO
-- Información sobre plazas de garaje y trasteros
-- =====================================================================================

-- 17. TIPO DE PARKING (Opcional + No Filtrable)
-- Valores típicos: "Incluido en Precio", "No Incluido", "Garaje Privado", "Comunitario", "Opcional", "Sin Parking"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'parking_type', 'Tipo de Parking', 'text', false, false);

-- 18. PLAZAS DE PARKING (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'parking_spaces', 'Plazas de Parking', 'number', false, false);

-- 19. TRASTERO (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_storage_room', 'Trastero', 'boolean', false, false);

-- 20. SUPERFICIE TRASTERO (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'storage_surface', 'Superficie Trastero (m²)', 'number', false, false);

-- =====================================================================================
-- SECCIÓN 5: ESPACIOS EXTERIORES
-- Terrazas, balcones, jardines y patios
-- =====================================================================================

-- 21. TERRAZA (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_terrace', 'Terraza', 'boolean', false, false);

-- 22. SUPERFICIE TERRAZA (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'terrace_surface', 'Superficie Terraza (m²)', 'number', false, false);

-- 23. BALCÓN (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_balcony', 'Balcón', 'boolean', false, false);

-- 24. JARDÍN (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_garden', 'Jardín', 'boolean', false, false);

-- 25. SUPERFICIE JARDÍN (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'garden_surface', 'Superficie Jardín (m²)', 'number', false, false);

-- 26. PATIO (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_patio', 'Patio', 'boolean', false, false);

-- =====================================================================================
-- SECCIÓN 6: PISCINA
-- Información sobre piscinas privadas y comunitarias
-- =====================================================================================

-- 27. TIPO DE PISCINA (Opcional + No Filtrable)
-- Valores típicos: "Privada", "Comunitaria", "Privada Infinity", "Climatizada", "Sin Piscina"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'pool_type', 'Piscina', 'text', false, false);

-- =====================================================================================
-- SECCIÓN 7: ORIENTACIÓN Y VISTAS
-- Información sobre orientación solar y vistas de la propiedad
-- =====================================================================================

-- 28. ORIENTACIÓN (Opcional + No Filtrable)
-- Valores típicos: "Norte", "Sur", "Este", "Oeste", "Noreste", "Noroeste", "Sureste", "Suroeste"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'orientation', 'Orientación', 'text', false, false);

-- 29. VISTAS (Opcional + No Filtrable con Arrays)
-- Valores típicos: ["Mar", "Montaña", "Ciudad", "Parque", "Jardín", "Panorámicas", "Despejadas", "Playa", "Patio Interior"]
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'views', 'Vistas', 'text_array', false, false);

-- 30. EXTERIOR/INTERIOR (Opcional + No Filtrable)
-- Indica si la propiedad es exterior (da a la calle/fachada) o interior (patio de luces)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'is_exterior', 'Exterior', 'boolean', false, false);

-- =====================================================================================
-- SECCIÓN 8: CLIMATIZACIÓN Y CALEFACCIÓN
-- Sistemas de confort térmico
-- =====================================================================================

-- 31. TIPO DE CALEFACCIÓN (Opcional + No Filtrable)
-- Valores típicos: "Individual Gas Natural", "Central", "Radiadores Gas", "Aerotermia Suelo Radiante", "Bomba de Calor", "Eléctrica", "No"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'heating_type', 'Tipo de Calefacción', 'text', false, false);

-- 32. AIRE ACONDICIONADO (Opcional + No Filtrable)
-- Valores típicos: "Splits", "Conductos Centralizado", "Bomba de Calor", "Preinstalación", "No"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'air_conditioning', 'Aire Acondicionado', 'text', false, false);

-- =====================================================================================
-- SECCIÓN 9: COCINA Y EQUIPAMIENTO INTERIOR
-- Características de la cocina y equipamiento básico
-- =====================================================================================

-- 33. TIPO DE COCINA (Opcional + No Filtrable)
-- Valores típicos: "Americana Equipada", "Office Equipada", "Independiente Equipada", "Americana Abierta", "Integrada", "Office con Isla"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'kitchen_type', 'Tipo de Cocina', 'text', false, false);

-- 34. ARMARIOS EMPOTRADOS (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'built_in_wardrobes', 'Armarios Empotrados', 'boolean', false, false);

-- 35. AMUEBLADO (Opcional + No Filtrable)
-- Valores típicos: "Totalmente Amueblado", "Parcialmente Amueblado", "Sin Amueblar", "Opcional"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'furnished', 'Amueblado', 'text', false, false);

-- 36. CHIMENEA (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_fireplace', 'Chimenea', 'boolean', false, false);

-- =====================================================================================
-- SECCIÓN 10: CERTIFICACIÓN ENERGÉTICA
-- Información sobre eficiencia energética y sostenibilidad
-- =====================================================================================

-- 37. CERTIFICACIÓN ENERGÉTICA (Opcional + No Filtrable)
-- Valores: "A", "B", "C", "D", "E", "F", "G", "En Trámite", "Exento"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'energy_certificate', 'Certificación Energética', 'text', false, false);

-- 38. CONSUMO ENERGÉTICO (Opcional + No Filtrable)
-- En kWh/m²·año
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'energy_consumption', 'Consumo Energético (kWh/m²·año)', 'number', false, false);

-- 39. EMISIONES CO2 (Opcional + No Filtrable)
-- En kg/m²·año
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'co2_emissions', 'Emisiones CO₂ (kg/m²·año)', 'number', false, false);

-- =====================================================================================
-- SECCIÓN 11: INFORMACIÓN FISCAL Y LEGAL
-- Datos catastrales, impuestos y gastos
-- =====================================================================================

-- 40. REFERENCIA CATASTRAL (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'cadastral_reference', 'Referencia Catastral', 'text', false, false);

-- 41. IBI ANUAL (Opcional + No Filtrable)
-- Impuesto sobre Bienes Inmuebles en €/año
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'ibi_annual', 'IBI Anual (€)', 'number', false, false);

-- 42. GASTOS DE COMUNIDAD (Opcional + No Filtrable)
-- En €/mes
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'community_fees', 'Gastos Comunidad (€/mes)', 'number', false, false);

-- =====================================================================================
-- SECCIÓN 12: CARACTERÍSTICAS ADICIONALES Y EXTRAS
-- Servicios, equipamiento especial y características destacadas
-- =====================================================================================

-- 43. CARACTERÍSTICAS DESTACADAS (Opcional + No Filtrable con Arrays)
-- Array para múltiples valores: ["Luminoso", "Primera Línea Playa", "Reformado", "Finca Regia", "Portería", "Seguridad 24h", etc.]
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'features', 'Características Destacadas', 'text_array', false, false);

-- 44. SUELOS (Opcional + No Filtrable)
-- Valores típicos: "Parquet", "Gres", "Mármol", "Hidráulicos", "Piedra Natural", "Terrazo", "Laminado"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'flooring_type', 'Tipo de Suelo', 'text', false, false);

-- 45. TECHOS ALTOS (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'high_ceilings', 'Techos Altos', 'boolean', false, false);

-- 46. ALTURA TECHOS (Opcional + No Filtrable)
-- En metros
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'ceiling_height', 'Altura Techos (m)', 'number', false, false);

-- 47. PORTERÍA/CONSERJE (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_concierge', 'Portería/Conserje', 'boolean', false, false);

-- 48. SEGURIDAD (Opcional + No Filtrable)
-- Valores típicos: "Alarma", "Vigilancia 24h", "Cámaras", "Puerta Blindada", "Video Portero", "No"
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'security_type', 'Sistema de Seguridad', 'text', false, false);

-- 49. DOMÓTICA (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_home_automation', 'Domótica', 'boolean', false, false);

-- 50. ACCESIBILIDAD ADAPTADA (Opcional + No Filtrable)
-- Para personas con movilidad reducida
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'wheelchair_accessible', 'Accesible para Movilidad Reducida', 'boolean', false, false);

-- =====================================================================================
-- SECCIÓN 13: SERVICIOS COMUNITARIOS
-- Instalaciones y servicios en la comunidad/urbanización
-- =====================================================================================

-- 51. GIMNASIO (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_gym', 'Gimnasio', 'boolean', false, false);

-- 52. ZONA INFANTIL (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_playground', 'Zona Infantil', 'boolean', false, false);

-- 53. PÁDEL/TENIS (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_paddle_tennis', 'Pádel/Tenis', 'boolean', false, false);

-- 54. ZONA VERDE COMUNITARIA (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_communal_gardens', 'Jardines Comunitarios', 'boolean', false, false);

-- =====================================================================================
-- SECCIÓN 14: USO Y DISPONIBILIDAD
-- Información sobre el uso permitido y disponibilidad
-- =====================================================================================

-- 55. LICENCIA TURÍSTICA (Opcional + No Filtrable)
-- Importante para inversores y alquiler vacacional
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'has_tourist_license', 'Licencia Turística', 'boolean', false, false);

-- 56. NÚMERO LICENCIA TURÍSTICA (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'tourist_license_number', 'Nº Licencia Turística', 'text', false, false);

-- 57. DISPONIBLE DESDE (Opcional + No Filtrable)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'available_from', 'Disponible Desde', 'date', false, false);

-- 58. SE ADMITEN MASCOTAS (Opcional + No Filtrable)
-- Para alquileres
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'pets_allowed', 'Se Admiten Mascotas', 'boolean', false, false);

-- =====================================================================================
-- SECCIÓN 15: INFORMACIÓN COMPLEMENTARIA
-- Notas adicionales y detalles comerciales
-- =====================================================================================

-- 59. REFERENCIA INTERNA (Opcional + No Filtrable)
-- Código de referencia interna de la inmobiliaria
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'internal_reference', 'Referencia', 'text', false, false);

-- 60. NOTAS ADICIONALES (Opcional + No Filtrable)
-- Información extra que no encaja en otros campos
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'additional_notes', 'Notas Adicionales', 'text', false, false);

-- 61. ÚLTIMO PRECIO (Opcional + No Filtrable)
-- Para tracking interno de bajadas de precio
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'previous_price', 'Precio Anterior', 'number', false, false);

-- 62. AGENTE ASIGNADO (Opcional + No Filtrable)
-- Nombre del agente responsable de la propiedad
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'assigned_agent', 'Agente Asignado', 'text', false, false);

-- 63. EXCLUSIVA (Opcional + No Filtrable)
-- Si la propiedad se comercializa en exclusiva por RegiaMare
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'is_exclusive', 'En Exclusiva', 'boolean', false, false);

-- 64. DESTACADA (Opcional + No Filtrable)
-- Para marcar propiedades premium que se muestren con más prominencia
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'is_featured', 'Propiedad Destacada', 'boolean', false, false);

UPDATE public.attribute_definitions
SET 
  is_filterable = true,
  is_required = true
WHERE company_id = 'eac2ccbe-cc36-40cd-bb7e-d5fe44de972d'
  AND item_type = 'regiamare_property'
  AND key = 'operation_type';

-- 65. AÑADIR DESCRIPCIÓN EN INGLÉS (Opcional)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'description_english', 'Descripción en Inglés', 'longtext', false, false);

-- 66. AÑADIR DESCRIPCIÓN EN FRANCÉS (Opcional)
INSERT INTO public.attribute_definitions (company_id, item_type, key, label, data_type, is_filterable, is_required)
VALUES 
  ('eac2ccbe-cc36-40cd-bb7e-d5fe44de972d', 'regiamare_property', 'description_french', 'Descripción en Francés', 'longtext', false, false);

-- =====================================================================================
-- RESUMEN DE DEFINICIONES CREADAS
-- =====================================================================================
-- Total de atributos: 64
--
-- Distribución por requisitos:
-- - Obligatorios (is_required = true): 11 atributos
-- - Filtrables (is_filterable = true): 4 atributos (price, zone, bedrooms, property_type)
-- - Solo informativos (no filtrables): 60 atributos
--
-- Distribución por tipo de dato:
-- - text: 29 atributos
-- - number: 22 atributos
-- - boolean: 20 atributos
-- - text_array: 2 atributos
-- - date: 1 atributo
--
-- FILTROS ACTIVOS:
-- Solo 4 atributos son filtrables por decisión de negocio (inmobiliaria nueva):
-- 1. price - Precio (rango min-max)
-- 2. zone - Zona geográfica (Barcelona, Sitges, Sant Pere de Ribes, etc.)
-- 3. bedrooms - Número de habitaciones
-- 4. property_type - Tipo de propiedad (Piso, Casa, Villa, etc.)
--
-- Categorías principales:
-- 1. Básicos Obligatorios (11): Los fundamentales para cualquier publicación
-- 2. Ubicación y Superficie (3): Detalles geográficos y dimensionales adicionales
-- 3. Estructura (3): Planta, ascensor, año construcción
-- 4. Parking y Almacenamiento (4): Garajes y trasteros
-- 5. Espacios Exteriores (6): Terrazas, jardines, patios
-- 6. Piscina (1): Tipo de piscina
-- 7. Orientación y Vistas (3): Exposición solar y panorámicas
-- 8. Climatización (2): Calefacción y aire acondicionado
-- 9. Cocina y Equipamiento (4): Cocina, armarios, muebles, chimenea
-- 10. Certificación Energética (3): Eficiencia y consumo
-- 11. Fiscal y Legal (3): Catastro, IBI, comunidad
-- 12. Características Adicionales (8): Extras y equipamiento especial
-- 13. Servicios Comunitarios (4): Instalaciones en la urbanización
-- 14. Uso y Disponibilidad (4): Licencias, disponibilidad, mascotas
-- 15. Información Complementaria (6): Notas y gestión interna
--
-- =====================================================================================
-- NOTAS DE IMPLEMENTACIÓN
-- =====================================================================================
--
-- 1. VALORES PREDEFINIDOS:
--    Muchos atributos de tipo 'text' deberían tener valores predefinidos en el frontend
--    (selectores dropdown) aunque se almacenan como texto para flexibilidad futura.
--    Ejemplos: property_type, operation_type, heating_type, pool_type, etc.
--
-- 2. VALIDACIONES RECOMENDADAS:
--    - price > 0
--    - built_surface > 0
--    - bedrooms >= 0
--    - bathrooms >= 0
--    - year_built >= 1800 AND year_built <= YEAR(CURRENT_DATE)
--    - energy_certificate IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'En Trámite', 'Exento')
--
-- 3. BÚSQUEDAS COMUNES:
--    Los filtros más usados por compradores son:
--    - Rango de precio (price)
--    - Ubicación (province, city, zone)
--    - Tipo de propiedad (property_type)
--    - Habitaciones mínimas (bedrooms)
--    - Superficie mínima (built_surface)
--    - Características especiales (pool_type, has_terrace, views, parking_spaces)
--
-- 4. MULTI-IDIOMA:
--    Los labels están en español. Para una implementación multiidioma,
--    estos deberían traducirse en el frontend, no en la base de datos.
--
-- 5. INTEGRACIÓN CON item_media:
--    Las imágenes se gestionan por separado en la tabla item_media.
--    Recomendaciones:
--    - Mínimo 1 imagen de portada obligatoria para publicar
--    - Máximo 50 imágenes por propiedad
--    - 1-2 PDFs para documentación (planos, certificado energético, etc.)
--
-- 6. COMPATIBILIDAD CON PORTALES:
--    Esta estructura es compatible con exportación a:
--    - Idealista
--    - Fotocasa
--    - Habitaclia
--    - Portales internacionales (Green-Acres, Kyero, etc.)
--
-- 7. ORDEN DE VISUALIZACIÓN:
--    En el frontend, se recomienda agrupar los atributos por categorías
--    y mostrarlos en este orden:
--    1. Información básica (precio, tipo, ubicación)
--    2. Características principales (m², habitaciones, baños)
--    3. Espacios exteriores
--    4. Equipamiento
--    5. Eficiencia energética
--    6. Información adicional
--
-- =====================================================================================
-- CHANGELOG
-- =====================================================================================
-- Versión 1.0 - 2026-02-05
-- - Creación inicial basada en análisis de mercado español
-- - 64 atributos definidos para sector inmobiliario residencial
-- - Basado en análisis de Premium Houses, Durán Carasso y Apple Houses
-- - Compatible con estándares de portales inmobiliarios españoles
-- =====================================================================================
