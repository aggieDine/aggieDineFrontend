// Static fallback data — used when S3 fetch and AsyncStorage cache both fail.
// Primary data source is the S3 scrape via DiningDataContext.
export const DINING_HALLS = [
  {
    id: 'sbisa',
    name: 'Sbisa Dining Hall',
    category: 'Dining Hall',
    coordinates: { latitude: 30.6167, longitude: -96.3435 },
    status: { isOpen: true },
    description: 'Historic all-you-care-to-eat dining hall serving a rotating selection of home-style meals, salads, and desserts.',
    hours: [
      { label: 'Breakfast', time: '7:00 AM – 10:00 AM' },
      { label: 'Lunch', time: '11:00 AM – 2:00 PM' },
      { label: 'Dinner', time: '5:00 PM – 8:00 PM' },
    ],
    menu: [
      { section: 'Entrees', items: [
        { name: 'Grilled Chicken Breast', price: null, tags: ['GF'] },
        { name: 'Beef Lasagna', price: null, tags: [] },
        { name: 'Blackened Tilapia', price: null, tags: ['GF'] },
        { name: 'Vegetable Stir Fry', price: null, tags: ['V', 'VG'] },
      ]},
      { section: 'Sides', items: [
        { name: 'Mashed Potatoes & Gravy', price: null, tags: ['V'] },
        { name: 'Steamed Broccoli', price: null, tags: ['V', 'VG', 'GF'] },
        { name: 'Mac & Cheese', price: null, tags: ['V'] },
        { name: 'Cornbread', price: null, tags: ['V'] },
      ]},
      { section: 'Salad Bar', items: [
        { name: 'Build Your Own Salad', price: null, tags: ['V', 'GF'] },
        { name: 'Soup of the Day', price: null, tags: [] },
      ]},
      { section: 'Desserts', items: [
        { name: 'Chocolate Cake', price: null, tags: ['V'] },
        { name: 'Fresh Fruit', price: null, tags: ['V', 'VG', 'GF'] },
      ]},
    ],
  },
  {
    id: 'commons',
    name: 'The Commons',
    category: 'Dining Hall',
    coordinates: { latitude: 30.6189, longitude: -96.3382 },
    status: { isOpen: true },
    description: 'All-you-care-to-eat dining hall on east campus featuring diverse stations including pizza, grill, deli, and international cuisine.',
    hours: [
      { label: 'Breakfast', time: '7:00 AM – 10:00 AM' },
      { label: 'Lunch', time: '11:00 AM – 2:00 PM' },
      { label: 'Dinner', time: '5:00 PM – 8:30 PM' },
    ],
    menu: [
      { section: 'Grill Station', items: [
        { name: 'Cheeseburger', price: null, tags: [] },
        { name: 'Grilled Chicken Sandwich', price: null, tags: [] },
        { name: 'Veggie Burger', price: null, tags: ['V'] },
        { name: 'French Fries', price: null, tags: ['V', 'VG'] },
      ]},
      { section: 'Pizza Station', items: [
        { name: 'Pepperoni Pizza', price: null, tags: [] },
        { name: 'Cheese Pizza', price: null, tags: ['V'] },
        { name: 'BBQ Chicken Pizza', price: null, tags: [] },
      ]},
      { section: 'International', items: [
        { name: 'Chicken Tikka Masala', price: null, tags: ['GF'] },
        { name: 'Fried Rice', price: null, tags: ['V'] },
        { name: 'Beef Tacos', price: null, tags: [] },
      ]},
      { section: 'Desserts', items: [
        { name: 'Cookies', price: null, tags: ['V'] },
        { name: 'Ice Cream', price: null, tags: ['V'] },
      ]},
    ],
  },
  {
    id: 'rev',
    name: "Rev's Grille",
    category: 'Fast Food',
    coordinates: { latitude: 30.612, longitude: -96.3414 },
    status: { isOpen: true },
    description: 'Quick-service grill in the MSC featuring burgers, chicken tenders, and classic American fare.',
    hours: [
      { label: 'All Day', time: '10:30 AM – 9:00 PM' },
    ],
    menu: [
      { section: 'Burgers', items: [
        { name: 'Classic Burger', price: '$7.49', tags: [] },
        { name: 'Bacon Cheeseburger', price: '$8.99', tags: [] },
        { name: 'Mushroom Swiss Burger', price: '$8.49', tags: [] },
      ]},
      { section: 'Chicken', items: [
        { name: 'Chicken Tenders (4pc)', price: '$6.99', tags: [] },
        { name: 'Crispy Chicken Sandwich', price: '$7.49', tags: [] },
      ]},
      { section: 'Sides', items: [
        { name: 'Fries', price: '$2.99', tags: ['V', 'VG'] },
        { name: 'Onion Rings', price: '$3.49', tags: ['V'] },
        { name: 'Side Salad', price: '$3.99', tags: ['V', 'GF'] },
      ]},
      { section: 'Drinks', items: [
        { name: 'Fountain Drink', price: '$1.99', tags: ['V'] },
        { name: 'Milkshake', price: '$4.49', tags: ['V'] },
      ]},
    ],
  },
  {
    id: 'panda',
    name: 'Panda Express',
    category: 'Fast Food',
    coordinates: { latitude: 30.6122, longitude: -96.3418 },
    status: { isOpen: true },
    description: 'Chinese-American quick-service restaurant offering wok-fired entrees and sides.',
    hours: [
      { label: 'All Day', time: '10:30 AM – 8:00 PM' },
    ],
    menu: [
      { section: 'Entrees', items: [
        { name: 'Orange Chicken', price: null, tags: [] },
        { name: 'Beijing Beef', price: null, tags: [] },
        { name: 'Broccoli Beef', price: null, tags: [] },
        { name: 'Kung Pao Chicken', price: null, tags: [] },
        { name: 'Honey Walnut Shrimp', price: null, tags: [] },
      ]},
      { section: 'Sides', items: [
        { name: 'Fried Rice', price: null, tags: ['V'] },
        { name: 'Chow Mein', price: null, tags: ['V'] },
        { name: 'White Rice', price: null, tags: ['V', 'VG', 'GF'] },
      ]},
      { section: 'Plates', items: [
        { name: 'Bowl (1 Entree + 1 Side)', price: '$8.29', tags: [] },
        { name: 'Plate (2 Entrees + 1 Side)', price: '$9.79', tags: [] },
        { name: 'Bigger Plate (3 Entrees + 1 Side)', price: '$11.29', tags: [] },
      ]},
    ],
  },
  {
    id: 'chick',
    name: 'Chick-fil-A',
    category: 'Fast Food',
    coordinates: { latitude: 30.6124, longitude: -96.3412 },
    status: { isOpen: false },
    description: 'Popular chicken sandwich chain known for its original chicken sandwich and waffle fries.',
    hours: [
      { label: 'Mon–Fri', time: '7:30 AM – 9:00 PM' },
      { label: 'Saturday', time: '10:00 AM – 4:00 PM' },
      { label: 'Sunday', time: 'Closed' },
    ],
    menu: [
      { section: 'Sandwiches', items: [
        { name: 'Chick-fil-A Chicken Sandwich', price: '$5.69', tags: [] },
        { name: 'Spicy Chicken Sandwich', price: '$6.19', tags: [] },
        { name: 'Grilled Chicken Sandwich', price: '$6.89', tags: [] },
      ]},
      { section: 'Nuggets & Strips', items: [
        { name: 'Nuggets (8ct)', price: '$5.29', tags: [] },
        { name: 'Chick-n-Strips (3ct)', price: '$5.69', tags: [] },
      ]},
      { section: 'Sides', items: [
        { name: 'Waffle Fries', price: '$2.59', tags: ['V', 'VG'] },
        { name: 'Fruit Cup', price: '$3.49', tags: ['V', 'VG', 'GF'] },
        { name: 'Mac & Cheese', price: '$3.49', tags: ['V'] },
      ]},
      { section: 'Drinks', items: [
        { name: 'Lemonade', price: '$2.49', tags: ['V'] },
        { name: 'Iced Tea', price: '$1.99', tags: ['V', 'VG'] },
      ]},
    ],
  },
  {
    id: 'starbucks_msc',
    name: 'Starbucks (MSC)',
    category: 'Coffee',
    coordinates: { latitude: 30.6125, longitude: -96.341 },
    status: { isOpen: true },
    description: 'Full-service Starbucks coffeehouse located inside the Memorial Student Center.',
    hours: [
      { label: 'Mon–Fri', time: '7:00 AM – 8:00 PM' },
      { label: 'Weekends', time: '8:00 AM – 5:00 PM' },
    ],
    menu: [
      { section: 'Hot Drinks', items: [
        { name: 'Pike Place Roast', price: '$2.75', tags: ['V', 'VG'] },
        { name: 'Caffe Latte', price: '$4.95', tags: ['V'] },
        { name: 'Caramel Macchiato', price: '$5.45', tags: ['V'] },
        { name: 'Chai Tea Latte', price: '$4.95', tags: ['V'] },
      ]},
      { section: 'Cold Drinks', items: [
        { name: 'Iced Coffee', price: '$3.45', tags: ['V', 'VG'] },
        { name: 'Cold Brew', price: '$3.95', tags: ['V', 'VG'] },
        { name: 'Strawberry Acai Refresher', price: '$4.75', tags: ['V', 'VG'] },
      ]},
      { section: 'Food', items: [
        { name: 'Bacon Gouda Sandwich', price: '$4.95', tags: [] },
        { name: 'Spinach Feta Wrap', price: '$4.75', tags: ['V'] },
        { name: 'Cake Pop', price: '$2.95', tags: ['V'] },
      ]},
    ],
  },
  {
    id: 'duncan',
    name: 'Duncan Dining Hall',
    category: 'Dining Hall',
    coordinates: { latitude: 30.625, longitude: -96.347 },
    status: { isOpen: true },
    description: 'All-you-care-to-eat dining hall on west campus with comfort food favorites and daily specials.',
    hours: [
      { label: 'Breakfast', time: '7:00 AM – 10:00 AM' },
      { label: 'Lunch', time: '11:00 AM – 2:00 PM' },
      { label: 'Dinner', time: '5:00 PM – 8:00 PM' },
    ],
    menu: [
      { section: 'Entrees', items: [
        { name: 'Roasted Turkey', price: null, tags: ['GF'] },
        { name: 'Spaghetti & Meatballs', price: null, tags: [] },
        { name: 'Baked Salmon', price: null, tags: ['GF'] },
        { name: 'Tofu Bowl', price: null, tags: ['V', 'VG', 'GF'] },
      ]},
      { section: 'Sides', items: [
        { name: 'Roasted Vegetables', price: null, tags: ['V', 'VG', 'GF'] },
        { name: 'Rice Pilaf', price: null, tags: ['V', 'VG'] },
        { name: 'Dinner Rolls', price: null, tags: ['V'] },
      ]},
      { section: 'Salad & Soup', items: [
        { name: 'Garden Salad Bar', price: null, tags: ['V', 'GF'] },
        { name: 'Tomato Basil Soup', price: null, tags: ['V'] },
      ]},
    ],
  },
  {
    id: 'hullabaloo',
    name: 'Hullabaloo Cafe',
    category: 'Cafe',
    coordinates: { latitude: 30.6185, longitude: -96.3395 },
    status: { isOpen: true },
    description: 'Casual cafe in Hullabaloo Hall offering sandwiches, salads, smoothies, and grab-and-go snacks.',
    hours: [
      { label: 'Mon–Thu', time: '7:00 AM – 10:00 PM' },
      { label: 'Friday', time: '7:00 AM – 8:00 PM' },
      { label: 'Weekends', time: '10:00 AM – 6:00 PM' },
    ],
    menu: [
      { section: 'Sandwiches', items: [
        { name: 'Turkey Club', price: '$7.99', tags: [] },
        { name: 'Caprese Panini', price: '$7.49', tags: ['V'] },
        { name: 'BLT', price: '$6.99', tags: [] },
      ]},
      { section: 'Bowls & Salads', items: [
        { name: 'Chicken Caesar Salad', price: '$8.49', tags: ['GF'] },
        { name: 'Quinoa Power Bowl', price: '$8.99', tags: ['V', 'VG', 'GF'] },
      ]},
      { section: 'Smoothies', items: [
        { name: 'Berry Blast', price: '$5.49', tags: ['V', 'VG', 'GF'] },
        { name: 'Green Machine', price: '$5.49', tags: ['V', 'VG', 'GF'] },
        { name: 'Mango Tropical', price: '$5.49', tags: ['V', 'VG', 'GF'] },
      ]},
      { section: 'Grab & Go', items: [
        { name: 'Protein Bar', price: '$2.99', tags: ['V'] },
        { name: 'Fresh Fruit Cup', price: '$3.49', tags: ['V', 'VG', 'GF'] },
        { name: 'Chips', price: '$1.79', tags: ['V', 'VG'] },
      ]},
    ],
  },
];

export function getDiningHallById(id) {
  return DINING_HALLS.find((hall) => hall.id === id) ?? null;
}
