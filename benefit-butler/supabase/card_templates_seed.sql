-- Optional starter template seed. Review against official issuer pages before
-- using these in production, because card terms change frequently.

insert into public.card_templates (issuer, card_name, annual_fee, official_url, last_reviewed_at, template_data)
values
('American Express', 'Platinum Card', 895, 'https://www.americanexpress.com/us/credit-cards/card/platinum-card/', now(), '{"benefits":["Airline Fee Credit","Uber Cash","Digital Entertainment Credit","Lululemon Credit","Hotel Credit","CLEAR Plus Credit"]}'::jsonb),
('American Express', 'Gold Card', 325, 'https://www.americanexpress.com/us/credit-cards/card/gold-card/', now(), '{"benefits":["Uber Cash","Dining Credit","Resy Credit","Dunkin Credit","Grocery 4x"]}'::jsonb),
('Capital One', 'Venture X', 395, 'https://www.capitalone.com/credit-cards/venture-x/', now(), '{"benefits":["Travel Credit","Anniversary Miles","Global Entry / TSA PreCheck"]}'::jsonb),
('Chase', 'Sapphire Reserve', 795, 'https://creditcards.chase.com/rewards-credit-cards/sapphire/reserve', now(), '{"benefits":["Travel Credit","Dining Credit","StubHub Credit","Apple TV+ and Apple Music","Priority Pass"]}'::jsonb),
('Chase', 'Sapphire Preferred', 95, 'https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred', now(), '{"benefits":["Hotel Credit","DoorDash DashPass","Travel Tracking"]}'::jsonb),
('Bilt', 'Bilt Mastercard', 0, 'https://www.biltrewards.com/card', now(), '{"benefits":["Rent Rewards","Rent Day Bonuses","Dining Rewards"]}'::jsonb),
('Citi', 'Strata Premier', 95, 'https://www.citi.com/credit-cards/citi-strata-premier-credit-card', now(), '{"benefits":["Annual Hotel Benefit","Gas/EV 3x Tracking","Grocery 3x Tracking"]}'::jsonb),
('American Express', 'Marriott Bonvoy Brilliant', 650, 'https://www.americanexpress.com/us/credit-cards/card/marriott-bonvoy-brilliant/', now(), '{"benefits":["Dining Credit","Free Night Award","Marriott Platinum Elite"]}'::jsonb),
('American Express', 'Hilton Honors Aspire', 550, 'https://www.americanexpress.com/us/credit-cards/card/hilton-honors-aspire/', now(), '{"benefits":["Hilton Resort Credit","Flight Credit","Free Night Reward","Hilton Diamond Status"]}'::jsonb),
('Chase', 'World of Hyatt', 95, 'https://creditcards.chase.com/travel-credit-cards/world-of-hyatt-credit-card', now(), '{"benefits":["Free Night Award","Hyatt Discoverist","Hyatt Spend Tracking"]}'::jsonb),
('Chase', 'United Explorer', 150, 'https://creditcards.chase.com/travel-credit-cards/united/united-explorer', now(), '{"benefits":["United TravelBank Cash","United Hotels Credit","Free Checked Bag"]}'::jsonb);

