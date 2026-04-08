const scenarios = {
    challenge: {
        shipmentType: 'One-way',
        origin: '1234 Main Street, Los Angeles, CA, USA',
        destination: '4321 Main St, Miami Lakes, FL, USA',
        itemType: 'Golf Bag (Standard)',
        itemCategory: 'Golf Bags',
        itemSize: 'Standard',
        items: [
            {
                category: 'Golf Bags',
                quantity: 1,
                sizes: ['Standard'],
            },
        ],
        serviceLevel: 'Ground',
        deliveryDate: 'Wednesday, April 29, 2026',
        // coverageAmount: '$5,000.00 ($29.99)',
           coverageAmount: '$2,500.00 ($8.99)',
        pickupMethod: 'haveThemPickedUp',
    },
    two_golf_bags_ground: {
        shipmentType: 'One-way',
        origin: '1234 Main Street, Los Angeles, CA, USA',
        destination: '4321 Main St, Miami Lakes, FL, USA',
        items: [
            {
                category: 'Golf Bags',
                quantity: 2,
                sizes: ['Standard', 'Staff/XL'],
            },
        ],
        serviceLevel: 'Ground',
        deliveryDate: 'Wednesday, April 29, 2026',
    },
};

const testData = {
    challenge: scenarios.challenge,
    scenarios,
    variations: {
        origins: [
            '1234 Main Street, Los Angeles, CA, USA',
            '100 Universal City Plaza, Universal City, CA, USA',
            '1600 Amphitheatre Parkway, Mountain View, CA, USA',
        ],
        destinations: [
            '4321 Main St, Miami Lakes, FL, USA',
            '1 Ocean Drive, Miami Beach, FL, USA',
            '2450 Biscayne Bay Blvd, Miami, FL, USA',
        ],
        itemTypes: {
            golfBags: ['Standard', 'Staff/XL'],
            luggage: ['Carry On', 'Checked', 'Oversized'],
        },
        serviceLevels: [
            'Ground',
            'Three Day Express',
            'Next Day Express',
            'Second Day Express',
        ],
    },

    invalidData: {
        addresses: [
            'Invalid Address XYZ123',
            '!@#$%^&*()',
            '',
        ],
    },

    timing: {
        autocompleteTimeout: 10000,
        pageLoadTimeout: 30000,
        typingDelay: 50,
    },

    // In your testData.js
authData: {
    // Hardcoded existing user for tests that skip sign-up
    login: {
        email: 'john@gmail.com',
        password: 'Password',
    },
    signUp: {
        get email() { return `test+${require('crypto').randomBytes(3).toString('hex').slice(0, 5)}@example.com`; },
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        country: 'United States of America',
        howDidYouHear: 'Influencer',
        phoneNumber: '151-351-3515',
    },
    payment: {
        firstName: 'John',
        lastName: 'Doe',
        cardNumber: '4242424242424242',
        expirationDate: '12/28',
        cvc: '123',
        billingCountry: 'United States of America',
        zipCode: '90001',
    },
},


    getScenarioEntries(selectedScenarioNames = []) {
        const requestedNames = selectedScenarioNames.filter(Boolean);

        if (requestedNames.length === 0) {
            return Object.entries(this.scenarios);
        }

        return requestedNames.map((name) => {
            const scenario = this.scenarios[name];
            if (!scenario) {
                throw new Error(`Unknown scenario: ${name}`);
            }

            return [name, scenario];
        });
    },
};

module.exports = testData;
