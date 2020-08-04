import ContainerImageSelectionApplication from "../container-image-selection-application";
import { createOwnedEntity, updateToken, itemCollected } from './main';
import { ItemType } from "./models";

/**
 * Application class to display to select an item that the token is
 * associated with
 */
export default class ItemConfigApplication extends FormApplication {
	private _html: any;

	/**
	 * This is an object of the loot that this container holds. The keys are the loot type
	 * `weapon`, `equipment`, `consumable`, `backpack`, `tool`, `loot`. The values will
	 * be an array of Item instance data
	 */
	private _loot: {
		[key: string]: any[];
	};

	static get defaultOptions(): ApplicationOptions {
		return mergeObject(super.defaultOptions, {
			closeOnSubmit: false,
			id: "pick-up-stix-item-config",
			template: "modules/pick-up-stix/module/pick-up-stix/templates/item-config.html",
			width: 500,
			height: 'auto',
			minimizable: false,
			title: `${game.user.isGM ? 'Configure Loot Container' : 'Loot Container'}`,
			resizable: true,
			classes: ['dnd5e', 'sheet', 'actor', 'character'],
			dragDrop: [{ dropSelector: null }]
		});
	}

	constructor(private _token: Token) {
		super({});
		console.log(`pick-up-stix | ItemConfigApplication | constructed with args:`)
		console.log(this._token);
		this._loot = { ...this._token.getFlag('pick-up-stix', 'pick-up-stix.containerLoot') } ?? {};
	}

	activateListeners(html) {
		console.log(`pick-up-stix | ItemConfigApplication | activateListeners`);
		this._html = html;
		super.activateListeners(this._html);

		// set the click listener on the image
		$(html).find(`[data-edit="img"]`).click(e => this._onEditImage(e));

		// set click listeners on the buttons to pick up individual items
		$(html).find(`a.item-take`).click(e => this._onTakeItem(e));
	}

	getData() {
		console.log(`pick-up-stix | ItemConfigApplication | getData`);
		const data = {
			object: this._token.data,
			containerDescription: getProperty(this._token.data, 'flags.pick-up-stix.pick-up-stix.initialState.itemData.data.description.value')?.replace(/font-size:\s*\d*.*;/, 'font-size: 18px;') ?? '',
			loot: this._loot
		};
		console.log(data);
		return data;
	}

	protected async _onTakeItem(e) {
		console.log(`pick-up-stix | ItemConfigApplication | _onTakeItem`);
		const itemId = e.currentTarget.dataset.id;
		const token = canvas.tokens.controlled?.[0];

		if (!token) {
			ui.notifications.error('You must be controlling only one token to pick up an item');
			return;
		}

		const actor = token.actor;

		const itemType = $(e.currentTarget).parents(`ol[data-itemType]`).attr('data-itemType');
		const itemData = this._loot?.[itemType]?.find(i => i._id === itemId);
		if (--itemData.qty === 0) {
			this._loot?.[itemType].findSplice(i => i._id === itemId);
		}
		setProperty(itemData, 'flags.pick-up-stix.pick-up-stix', {
			initialState: { id: itemData._id, count: 1, itemData: { ...itemData, flags: {} } },
			imageOriginalPath: itemData.img,
			itemType: ItemType.ITEM,
			isLocked: false
		});
		console.log([itemId, actor, itemType, itemData]);
		await createOwnedEntity(actor, [itemData]);
		itemCollected(token, itemData);
		this.submit();
	}

	protected _onEditImage(e) {
		console.log(`pick-up-stix | ItemConfigApplication | _onEditImage`);
		const f = new ContainerImageSelectionApplication(this._token).render(true);

		Hooks.once('closeContainerImageSelectionApplication', () => {
			console.log(`pick-up-stix | ItemConfigApplication | closeContainerImageSelectionApplication hook`);
			this.submit();
		});
	}

	protected async _onDrop(e) {
		console.log(`pick-up-stix | ItemConfigApplication | _onDrop`);
		const data = JSON.parse(e.dataTransfer.getData('text/plain'));
		console.log(data);

		if (data.type !== "Item") {
			console.log(`pick-up-stix | ItemConfigApplication | _onDrop | item is not 'Item' type`);
			return;
		}

		if (data.actorId) {
			await game.actors.get(data.actorId).deleteOwnedItem(data.data._id);
		}

		let itemData = data.data ?? await game.items.get(data.id)?.data ?? await game.packs.get(data.pack).getEntry(data.id);

		if (data.actorId) {
			itemData = { ...getProperty(itemData, 'flags.pick-up-stix.pick-up-stix.initialState.itemData') };
		}

		const itemType = itemData.type;

		if (!this._loot[itemType]) {
			this._loot[itemType] = [];
		}
		const existingItem = this._loot[itemType].find(i => i._id === itemData._id);
		if (existingItem) {
			existingItem.qty++;
		}
		else {
			itemData.qty = 1;
			this._loot[itemType].push(itemData);
		}
		await this.submit();
	}

	protected async _updateObject(e, formData) {
		console.log(`pick-up-stix | ItemConfigApplication | _onUpdateObject called with args:`);
		formData.img = this._token.getFlag('pick-up-stix', 'pick-up-stix.isOpen') ? this._token.getFlag('pick-up-stix', 'pick-up-stix.imageContainerOpenPath') : this._token.getFlag('pick-up-stix', 'pick-up-stix.imageContainerClosedPath');
		setProperty(formData, 'flags.pick-up-stix.pick-up-stix.containerLoot', { ...this._loot });
		delete formData._id;
		console.log([e, formData]);
		await updateToken(this._token, formData);
		this.render();
	}
}
