-- A list with no kids used to mean "everyone". Now it means nobody yet, so give each such list to every kid the family
-- has today: nothing changes for them, and kids added later only get the lists they're given.
INSERT INTO `list_children` (`list_id`, `child_id`)
SELECT `word_lists`.`id`, `children`.`id` FROM `word_lists`
INNER JOIN `children` ON `children`.`parent_id` = `word_lists`.`owner_id`
WHERE NOT EXISTS (SELECT 1 FROM `list_children` WHERE `list_children`.`list_id` = `word_lists`.`id`);
