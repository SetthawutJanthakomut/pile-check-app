-- Spec Table 4-1 driving tolerances (verticality / rake), 19-Oct-2026.
-- Values are N of 1:N. Rakes between tabulated values: N interpolated linearly in the app
-- (1:4.5 -> 28.75, 1:5 -> 32.5). tol_tilt_deg is kept but no longer used for the verdict.
insert into project_settings (key, value, description) values
 ('tol_perp_ratio', 75, 'Spec Table 4-1: max deviation in verticality / perpendicular to direction of rake = 1:N (all piles)'),
 ('tol_rake_1to4', 25, 'Spec Table 4-1: max deviation in direction of rake for 1:4 rake = 1:N'),
 ('tol_rake_1to6', 40, 'Spec Table 4-1: max deviation in direction of rake for 1:6 rake = 1:N'),
 ('tol_rake_1to8', 50, 'Spec Table 4-1: max deviation in direction of rake for 1:8 rake = 1:N. Other rakes: N interpolated linearly (1:4.5 -> 28.75, 1:5 -> 32.5)')
on conflict (key) do nothing;
update project_settings set description = 'NOT USED since 19-Oct-2026 (replaced by tol_perp_ratio / tol_rake_1toN, Spec Table 4-1)' where key = 'tol_tilt_deg';
